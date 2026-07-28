from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="ResubmitSubmissionBody")


@_attrs_define
class ResubmitSubmissionBody:
    """
    Attributes:
        manuscript_version_id (UUID):
    """

    manuscript_version_id: UUID
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        manuscript_version_id = str(self.manuscript_version_id)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "manuscriptVersionId": manuscript_version_id,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        manuscript_version_id = UUID(d.pop("manuscriptVersionId"))

        resubmit_submission_body = cls(
            manuscript_version_id=manuscript_version_id,
        )

        resubmit_submission_body.additional_properties = d
        return resubmit_submission_body

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
