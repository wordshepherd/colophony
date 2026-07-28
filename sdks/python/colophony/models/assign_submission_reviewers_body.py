from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="AssignSubmissionReviewersBody")


@_attrs_define
class AssignSubmissionReviewersBody:
    """
    Attributes:
        reviewer_user_ids (list[UUID]):
    """

    reviewer_user_ids: list[UUID]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        reviewer_user_ids = []
        for reviewer_user_ids_item_data in self.reviewer_user_ids:
            reviewer_user_ids_item = str(reviewer_user_ids_item_data)
            reviewer_user_ids.append(reviewer_user_ids_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "reviewerUserIds": reviewer_user_ids,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        reviewer_user_ids = []
        _reviewer_user_ids = d.pop("reviewerUserIds")
        for reviewer_user_ids_item_data in _reviewer_user_ids:
            reviewer_user_ids_item = UUID(reviewer_user_ids_item_data)

            reviewer_user_ids.append(reviewer_user_ids_item)

        assign_submission_reviewers_body = cls(
            reviewer_user_ids=reviewer_user_ids,
        )

        assign_submission_reviewers_body.additional_properties = d
        return assign_submission_reviewers_body

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
