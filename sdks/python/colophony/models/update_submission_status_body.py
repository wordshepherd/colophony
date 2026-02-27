from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.update_submission_status_body_status import UpdateSubmissionStatusBodyStatus
from ..types import UNSET, Unset






T = TypeVar("T", bound="UpdateSubmissionStatusBody")



@_attrs_define
class UpdateSubmissionStatusBody:
    """ 
        Attributes:
            status (UpdateSubmissionStatusBodyStatus): Target status for the transition
            comment (str | Unset): Optional comment for the status change (max 1,000 chars)
     """

    status: UpdateSubmissionStatusBodyStatus
    comment: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        status = self.status.value

        comment = self.comment


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "status": status,
        })
        if comment is not UNSET:
            field_dict["comment"] = comment

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        status = UpdateSubmissionStatusBodyStatus(d.pop("status"))




        comment = d.pop("comment", UNSET)

        update_submission_status_body = cls(
            status=status,
            comment=comment,
        )


        update_submission_status_body.additional_properties = d
        return update_submission_status_body

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
