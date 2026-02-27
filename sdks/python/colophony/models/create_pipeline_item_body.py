from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from uuid import UUID






T = TypeVar("T", bound="CreatePipelineItemBody")



@_attrs_define
class CreatePipelineItemBody:
    """ 
        Attributes:
            submission_id (UUID): Submission to enter the pipeline
            publication_id (UUID | Unset): Target publication (optional)
     """

    submission_id: UUID
    publication_id: UUID | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        submission_id = str(self.submission_id)

        publication_id: str | Unset = UNSET
        if not isinstance(self.publication_id, Unset):
            publication_id = str(self.publication_id)


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "submissionId": submission_id,
        })
        if publication_id is not UNSET:
            field_dict["publicationId"] = publication_id

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        submission_id = UUID(d.pop("submissionId"))




        _publication_id = d.pop("publicationId", UNSET)
        publication_id: UUID | Unset
        if isinstance(_publication_id,  Unset):
            publication_id = UNSET
        else:
            publication_id = UUID(_publication_id)




        create_pipeline_item_body = cls(
            submission_id=submission_id,
            publication_id=publication_id,
        )


        create_pipeline_item_body.additional_properties = d
        return create_pipeline_item_body

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
