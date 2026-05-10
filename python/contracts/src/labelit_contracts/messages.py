from typing import Any, Literal, Annotated
from pydantic import BaseModel, Field, RootModel

# Filesystem

FsEntryKind = Literal["dir", "file", "drive"]

class FsEntry(BaseModel):
    name: str
    path: str
    kind: FsEntryKind
    size: int | None = Field(default=None, ge=0)
    modifiedAt: str | None = None

class ListDirPayload(BaseModel):
    path: str
    patterns: list[str] | None = None

class DirListedPayload(BaseModel):
    path: str
    parent: str | None
    entries: list[FsEntry]

class RootsListedPayload(BaseModel):
    platform: Literal["windows", "darwin", "linux"]
    roots: list[FsEntry]

class HomeResolvedPayload(BaseModel):
    path: str

class SuggestSeriesTemplatesPayload(BaseModel):
    folder: str

class LoadSeriesDatasetPayload(BaseModel):
    folder: str
    subfolder_template: str | None = None
    filename_template: str | None = None

class OpenSeriesImagePayload(BaseModel):
    folder: str
    subfolder_template: str | None = None
    filename_template: str | None = None
    position: str
    time: str
    channel: str
    z: str

# Images

class OpenImagePayload(BaseModel):
    path: str

class OpenMasksPayload(BaseModel):
    path: str
    imagePath: str

class ImageMeta(BaseModel):
    path: str
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    channels: int = Field(gt=0)
    depth: int = Field(gt=0)
    dtype: str
    previewPng: str | None = None

class SavePathPayload(BaseModel):
    path: str | None = None

class SavedPayload(BaseModel):
    path: str

# Masks

class Point(BaseModel):
    x: float
    y: float

class StrokePayload(BaseModel):
    points: list[Point] = Field(min_length=1)
    radius: int = Field(gt=0)
    erase: bool | None = None

class RemoveAtPayload(BaseModel):
    x: float
    y: float

class RoiState(BaseModel):
    id: int
    contours: list[list[list[int]]]

class MaskState(BaseModel):
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    nRois: int = Field(ge=0)
    rois: list[RoiState]
    canUndo: bool
    canRedo: bool

class RemoveAtPointsPayload(BaseModel):
    points: list[Point] = Field(min_length=1)

class RemoveInRegionPayload(BaseModel):
    polygon: list[Point] = Field(min_length=3)

class MergeAtPayload(BaseModel):
    a: Point
    b: Point

# Models

class ModelInfo(BaseModel):
    name: str
    source: Literal["builtin", "custom"]

class RunModelPayload(BaseModel):
    model: str
    imagePath: str
    diameter: float | None = None
    flowThreshold: float | None = None
    cellprobThreshold: float | None = None
    niter: int | None = Field(default=None, ge=0)
    minSize: int | None = Field(default=None, ge=0)
    anisotropy: float | None = None
    useGpu: bool | None = None

class TrainModelPayload(BaseModel):
    baseModel: str
    trainDir: str
    modelName: str
    nEpochs: int | None = Field(default=None, gt=0)
    learningRate: float | None = Field(default=None, gt=0)
    weightDecay: float | None = Field(default=None, ge=0)
    batchSize: int | None = Field(default=None, gt=0)
    useGpu: bool | None = None

class ProgressPayload(BaseModel):
    job: Literal["run", "train"]
    progress: float = Field(ge=0, le=1)
    message: str | None = None

class RunDonePayload(BaseModel):
    imagePath: str
    nRois: int = Field(ge=0)
    segPath: str | None

class TrainDonePayload(BaseModel):
    modelName: str
    modelPath: str

# Client -> Server

class ClientMessageBase(BaseModel):
    type: str

class ClientMessageFsListRoots(ClientMessageBase):
    type: Literal["fs:list_roots"]

class ClientMessageFsListDir(ClientMessageBase):
    type: Literal["fs:list_dir"]
    payload: ListDirPayload

class ClientMessageFsHome(ClientMessageBase):
    type: Literal["fs:home"]

class ClientMessageFsSuggestSeriesTemplates(ClientMessageBase):
    type: Literal["fs:suggest_series_templates"]
    payload: SuggestSeriesTemplatesPayload

class ClientMessageFsLoadSeriesDataset(ClientMessageBase):
    type: Literal["fs:load_series_dataset"]
    payload: LoadSeriesDatasetPayload

class ClientMessageImageOpen(ClientMessageBase):
    type: Literal["image:open"]
    payload: OpenImagePayload

class ClientMessageImageOpenSeries(ClientMessageBase):
    type: Literal["image:open_series"]
    payload: OpenSeriesImagePayload

class ClientMessageImageOpenMasks(ClientMessageBase):
    type: Literal["image:open_masks"]
    payload: OpenMasksPayload

class ClientMessageImageSaveMasks(ClientMessageBase):
    type: Literal["image:save_masks"]
    payload: SavePathPayload

class ClientMessageImageSaveOutlines(ClientMessageBase):
    type: Literal["image:save_outlines"]
    payload: SavePathPayload

class ClientMessageImageSaveRois(ClientMessageBase):
    type: Literal["image:save_rois"]
    payload: SavePathPayload

class ClientMessageImageSaveFlows(ClientMessageBase):
    type: Literal["image:save_flows"]
    payload: SavePathPayload

class ClientMessageImageSaveSeg(ClientMessageBase):
    type: Literal["image:save_seg"]
    payload: SavePathPayload

class ClientMessageMaskStroke(ClientMessageBase):
    type: Literal["mask:stroke"]
    payload: StrokePayload

class ClientMessageMaskRemoveAt(ClientMessageBase):
    type: Literal["mask:remove_at"]
    payload: RemoveAtPayload

class ClientMessageMaskRemoveAtPoints(ClientMessageBase):
    type: Literal["mask:remove_at_points"]
    payload: RemoveAtPointsPayload

class ClientMessageMaskRemoveInRegion(ClientMessageBase):
    type: Literal["mask:remove_in_region"]
    payload: RemoveInRegionPayload

class ClientMessageMaskMergeAt(ClientMessageBase):
    type: Literal["mask:merge_at"]
    payload: MergeAtPayload

class ClientMessageMaskClear(ClientMessageBase):
    type: Literal["mask:clear"]

class ClientMessageMaskUndo(ClientMessageBase):
    type: Literal["mask:undo"]

class ClientMessageMaskRedo(ClientMessageBase):
    type: Literal["mask:redo"]

class ClientMessageMaskRequest(ClientMessageBase):
    type: Literal["mask:request"]

class ClientMessageModelList(ClientMessageBase):
    type: Literal["model:list"]

class ClientMessageModelRun(ClientMessageBase):
    type: Literal["model:run"]
    payload: RunModelPayload

class ClientMessageModelTrain(ClientMessageBase):
    type: Literal["model:train"]
    payload: TrainModelPayload

class ClientMessagePing(ClientMessageBase):
    type: Literal["ping"]

ClientMessage = Annotated[
    ClientMessageFsListRoots |
    ClientMessageFsListDir |
    ClientMessageFsHome |
    ClientMessageFsSuggestSeriesTemplates |
    ClientMessageFsLoadSeriesDataset |
    ClientMessageImageOpen |
    ClientMessageImageOpenSeries |
    ClientMessageImageOpenMasks |
    ClientMessageImageSaveMasks |
    ClientMessageImageSaveOutlines |
    ClientMessageImageSaveRois |
    ClientMessageImageSaveFlows |
    ClientMessageImageSaveSeg |
    ClientMessageMaskStroke |
    ClientMessageMaskRemoveAt |
    ClientMessageMaskRemoveAtPoints |
    ClientMessageMaskRemoveInRegion |
    ClientMessageMaskMergeAt |
    ClientMessageMaskClear |
    ClientMessageMaskUndo |
    ClientMessageMaskRedo |
    ClientMessageMaskRequest |
    ClientMessageModelList |
    ClientMessageModelRun |
    ClientMessageModelTrain |
    ClientMessagePing,
    Field(discriminator="type")
]

class ClientMessageAdapter(RootModel):
    root: ClientMessage

# Server -> Client

class SeriesDatasetPayload(BaseModel):
    folder: str
    template: str
    subfolder_template: str
    filename_template: str
    placeholders: list[str]
    axes: dict[str, list[str]]

class ServerMessageBase(BaseModel):
    type: str

class ServerMessageFsRootsListed(ServerMessageBase):
    type: Literal["fs:roots_listed"]
    payload: RootsListedPayload

class ServerMessageFsDirListed(ServerMessageBase):
    type: Literal["fs:dir_listed"]
    payload: DirListedPayload

class ServerMessageFsHomeResolved(ServerMessageBase):
    type: Literal["fs:home_resolved"]
    payload: HomeResolvedPayload

class ServerMessageFsSeriesTemplatesSuggested(ServerMessageBase):
    type: Literal["fs:series_templates_suggested"]
    payload: Any

class ServerMessageFsSeriesDatasetLoaded(ServerMessageBase):
    type: Literal["fs:series_dataset_loaded"]
    payload: SeriesDatasetPayload

class ServerMessageImageOpened(ServerMessageBase):
    type: Literal["image:opened"]
    payload: ImageMeta

class ServerMessageImageSaved(ServerMessageBase):
    type: Literal["image:saved"]
    payload: SavedPayload

class ServerMessageMaskUpdated(ServerMessageBase):
    type: Literal["mask:updated"]
    payload: MaskState

class ServerMessageModelListed(ServerMessageBase):
    type: Literal["model:listed"]
    payload: list[ModelInfo]

class ServerMessageModelProgress(ServerMessageBase):
    type: Literal["model:progress"]
    payload: ProgressPayload

class ServerMessageModelRunDone(ServerMessageBase):
    type: Literal["model:run_done"]
    payload: RunDonePayload

class ServerMessageModelTrainDone(ServerMessageBase):
    type: Literal["model:train_done"]
    payload: TrainDonePayload

class ServerMessagePong(ServerMessageBase):
    type: Literal["pong"]

class ServerMessageErrorPayload(BaseModel):
    message: str

class ServerMessageError(ServerMessageBase):
    type: Literal["error"]
    payload: ServerMessageErrorPayload

ServerMessage = Annotated[
    ServerMessageFsRootsListed |
    ServerMessageFsDirListed |
    ServerMessageFsHomeResolved |
    ServerMessageFsSeriesTemplatesSuggested |
    ServerMessageFsSeriesDatasetLoaded |
    ServerMessageImageOpened |
    ServerMessageImageSaved |
    ServerMessageMaskUpdated |
    ServerMessageModelListed |
    ServerMessageModelProgress |
    ServerMessageModelRunDone |
    ServerMessageModelTrainDone |
    ServerMessagePong |
    ServerMessageError,
    Field(discriminator="type")
]

class ServerMessageAdapter(RootModel):
    root: ServerMessage
