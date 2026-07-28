from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="GetSubmissionAnalyticsResponseTimeResponse200BucketsItem")


@_attrs_define
class GetSubmissionAnalyticsResponseTimeResponse200BucketsItem:
    """
    Attributes:
        label (str):
        count (int):
        min_days (float):
        max_days (float):
    """

    label: str
    count: int
    min_days: float
    max_days: float
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        label = self.label

        count = self.count

        min_days = self.min_days

        max_days = self.max_days

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "label": label,
                "count": count,
                "minDays": min_days,
                "maxDays": max_days,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        label = d.pop("label")

        count = d.pop("count")

        min_days = d.pop("minDays")

        max_days = d.pop("maxDays")

        get_submission_analytics_response_time_response_200_buckets_item = cls(
            label=label,
            count=count,
            min_days=min_days,
            max_days=max_days,
        )

        get_submission_analytics_response_time_response_200_buckets_item.additional_properties = d
        return get_submission_analytics_response_time_response_200_buckets_item

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
