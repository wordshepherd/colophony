from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="BatchAssignReviewersResponse200SucceededItem")


@_attrs_define
class BatchAssignReviewersResponse200SucceededItem:
    """
    Attributes:
        submission_id (UUID):
        assigned_count (int):
    """

    submission_id: UUID
    assigned_count: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        submission_id = str(self.submission_id)

        assigned_count = self.assigned_count

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "submissionId": submission_id,
                "assignedCount": assigned_count,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        submission_id = UUID(d.pop("submissionId"))

        assigned_count = d.pop("assignedCount")

        batch_assign_reviewers_response_200_succeeded_item = cls(
            submission_id=submission_id,
            assigned_count=assigned_count,
        )

        batch_assign_reviewers_response_200_succeeded_item.additional_properties = d
        return batch_assign_reviewers_response_200_succeeded_item

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
