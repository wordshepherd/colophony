from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.get_pipeline_history_response_200_item_from_stage_type_0 import GetPipelineHistoryResponse200ItemFromStageType0
from ..models.get_pipeline_history_response_200_item_to_stage import GetPipelineHistoryResponse200ItemToStage
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="GetPipelineHistoryResponse200Item")



@_attrs_define
class GetPipelineHistoryResponse200Item:
    """ 
        Attributes:
            id (UUID):
            pipeline_item_id (UUID):
            from_stage (GetPipelineHistoryResponse200ItemFromStageType0 | None):
            to_stage (GetPipelineHistoryResponse200ItemToStage): Current pipeline stage for the piece
            changed_by (None | UUID):
            comment (None | str):
            changed_at (datetime.datetime):
     """

    id: UUID
    pipeline_item_id: UUID
    from_stage: GetPipelineHistoryResponse200ItemFromStageType0 | None
    to_stage: GetPipelineHistoryResponse200ItemToStage
    changed_by: None | UUID
    comment: None | str
    changed_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        pipeline_item_id = str(self.pipeline_item_id)

        from_stage: None | str
        if isinstance(self.from_stage, GetPipelineHistoryResponse200ItemFromStageType0):
            from_stage = self.from_stage.value
        else:
            from_stage = self.from_stage

        to_stage = self.to_stage.value

        changed_by: None | str
        if isinstance(self.changed_by, UUID):
            changed_by = str(self.changed_by)
        else:
            changed_by = self.changed_by

        comment: None | str
        comment = self.comment

        changed_at = self.changed_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "pipelineItemId": pipeline_item_id,
            "fromStage": from_stage,
            "toStage": to_stage,
            "changedBy": changed_by,
            "comment": comment,
            "changedAt": changed_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        pipeline_item_id = UUID(d.pop("pipelineItemId"))




        def _parse_from_stage(data: object) -> GetPipelineHistoryResponse200ItemFromStageType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                from_stage_type_0 = GetPipelineHistoryResponse200ItemFromStageType0(data)



                return from_stage_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(GetPipelineHistoryResponse200ItemFromStageType0 | None, data)

        from_stage = _parse_from_stage(d.pop("fromStage"))


        to_stage = GetPipelineHistoryResponse200ItemToStage(d.pop("toStage"))




        def _parse_changed_by(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                changed_by_type_0 = UUID(data)



                return changed_by_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        changed_by = _parse_changed_by(d.pop("changedBy"))


        def _parse_comment(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        comment = _parse_comment(d.pop("comment"))


        changed_at = isoparse(d.pop("changedAt"))




        get_pipeline_history_response_200_item = cls(
            id=id,
            pipeline_item_id=pipeline_item_id,
            from_stage=from_stage,
            to_stage=to_stage,
            changed_by=changed_by,
            comment=comment,
            changed_at=changed_at,
        )


        get_pipeline_history_response_200_item.additional_properties = d
        return get_pipeline_history_response_200_item

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
