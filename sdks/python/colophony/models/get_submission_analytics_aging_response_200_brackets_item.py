from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.get_submission_analytics_aging_response_200_brackets_item_submissions_item import (
        GetSubmissionAnalyticsAgingResponse200BracketsItemSubmissionsItem,
    )


T = TypeVar("T", bound="GetSubmissionAnalyticsAgingResponse200BracketsItem")


@_attrs_define
class GetSubmissionAnalyticsAgingResponse200BracketsItem:
    """
    Attributes:
        label (str):
        count (int):
        submissions (list[GetSubmissionAnalyticsAgingResponse200BracketsItemSubmissionsItem]):
    """

    label: str
    count: int
    submissions: list[GetSubmissionAnalyticsAgingResponse200BracketsItemSubmissionsItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        label = self.label

        count = self.count

        submissions = []
        for submissions_item_data in self.submissions:
            submissions_item = submissions_item_data.to_dict()
            submissions.append(submissions_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "label": label,
                "count": count,
                "submissions": submissions,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_submission_analytics_aging_response_200_brackets_item_submissions_item import (
            GetSubmissionAnalyticsAgingResponse200BracketsItemSubmissionsItem,
        )

        d = dict(src_dict)
        label = d.pop("label")

        count = d.pop("count")

        submissions = []
        _submissions = d.pop("submissions")
        for submissions_item_data in _submissions:
            submissions_item = GetSubmissionAnalyticsAgingResponse200BracketsItemSubmissionsItem.from_dict(
                submissions_item_data
            )

            submissions.append(submissions_item)

        get_submission_analytics_aging_response_200_brackets_item = cls(
            label=label,
            count=count,
            submissions=submissions,
        )

        get_submission_analytics_aging_response_200_brackets_item.additional_properties = d
        return get_submission_analytics_aging_response_200_brackets_item

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
