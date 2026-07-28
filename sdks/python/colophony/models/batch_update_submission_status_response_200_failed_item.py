from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="BatchUpdateSubmissionStatusResponse200FailedItem")


@_attrs_define
class BatchUpdateSubmissionStatusResponse200FailedItem:
    """
    Attributes:
        submission_id (UUID):
        error (str):
    """

    submission_id: UUID
    error: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        submission_id = str(self.submission_id)

        error = self.error

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "submissionId": submission_id,
                "error": error,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        submission_id = UUID(d.pop("submissionId"))

        error = d.pop("error")

        batch_update_submission_status_response_200_failed_item = cls(
            submission_id=submission_id,
            error=error,
        )

        batch_update_submission_status_response_200_failed_item.additional_properties = d
        return batch_update_submission_status_response_200_failed_item

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
