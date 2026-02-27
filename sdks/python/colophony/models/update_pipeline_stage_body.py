from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.update_pipeline_stage_body_stage import UpdatePipelineStageBodyStage
from ..types import UNSET, Unset






T = TypeVar("T", bound="UpdatePipelineStageBody")



@_attrs_define
class UpdatePipelineStageBody:
    """ 
        Attributes:
            stage (UpdatePipelineStageBodyStage): Target stage
            comment (str | Unset): Optional comment for the transition
     """

    stage: UpdatePipelineStageBodyStage
    comment: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        stage = self.stage.value

        comment = self.comment


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "stage": stage,
        })
        if comment is not UNSET:
            field_dict["comment"] = comment

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        stage = UpdatePipelineStageBodyStage(d.pop("stage"))




        comment = d.pop("comment", UNSET)

        update_pipeline_stage_body = cls(
            stage=stage,
            comment=comment,
        )


        update_pipeline_stage_body.additional_properties = d
        return update_pipeline_stage_body

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
