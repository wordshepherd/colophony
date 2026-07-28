from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="BatchAssignReviewersBody")


@_attrs_define
class BatchAssignReviewersBody:
    """
    Attributes:
        submission_ids (list[UUID]):
        reviewer_user_ids (list[UUID]):
    """

    submission_ids: list[UUID]
    reviewer_user_ids: list[UUID]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        submission_ids = []
        for submission_ids_item_data in self.submission_ids:
            submission_ids_item = str(submission_ids_item_data)
            submission_ids.append(submission_ids_item)

        reviewer_user_ids = []
        for reviewer_user_ids_item_data in self.reviewer_user_ids:
            reviewer_user_ids_item = str(reviewer_user_ids_item_data)
            reviewer_user_ids.append(reviewer_user_ids_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "submissionIds": submission_ids,
                "reviewerUserIds": reviewer_user_ids,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        submission_ids = []
        _submission_ids = d.pop("submissionIds")
        for submission_ids_item_data in _submission_ids:
            submission_ids_item = UUID(submission_ids_item_data)

            submission_ids.append(submission_ids_item)

        reviewer_user_ids = []
        _reviewer_user_ids = d.pop("reviewerUserIds")
        for reviewer_user_ids_item_data in _reviewer_user_ids:
            reviewer_user_ids_item = UUID(reviewer_user_ids_item_data)

            reviewer_user_ids.append(reviewer_user_ids_item)

        batch_assign_reviewers_body = cls(
            submission_ids=submission_ids,
            reviewer_user_ids=reviewer_user_ids,
        )

        batch_assign_reviewers_body.additional_properties = d
        return batch_assign_reviewers_body

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
