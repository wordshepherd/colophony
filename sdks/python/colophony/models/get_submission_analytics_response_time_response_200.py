from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.get_submission_analytics_response_time_response_200_buckets_item import (
        GetSubmissionAnalyticsResponseTimeResponse200BucketsItem,
    )


T = TypeVar("T", bound="GetSubmissionAnalyticsResponseTimeResponse200")


@_attrs_define
class GetSubmissionAnalyticsResponseTimeResponse200:
    """
    Attributes:
        buckets (list[GetSubmissionAnalyticsResponseTimeResponse200BucketsItem]):
        median_days (float | None):
    """

    buckets: list[GetSubmissionAnalyticsResponseTimeResponse200BucketsItem]
    median_days: float | None
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        buckets = []
        for buckets_item_data in self.buckets:
            buckets_item = buckets_item_data.to_dict()
            buckets.append(buckets_item)

        median_days: float | None
        median_days = self.median_days

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "buckets": buckets,
                "medianDays": median_days,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_submission_analytics_response_time_response_200_buckets_item import (
            GetSubmissionAnalyticsResponseTimeResponse200BucketsItem,
        )

        d = dict(src_dict)
        buckets = []
        _buckets = d.pop("buckets")
        for buckets_item_data in _buckets:
            buckets_item = GetSubmissionAnalyticsResponseTimeResponse200BucketsItem.from_dict(buckets_item_data)

            buckets.append(buckets_item)

        def _parse_median_days(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        median_days = _parse_median_days(d.pop("medianDays"))

        get_submission_analytics_response_time_response_200 = cls(
            buckets=buckets,
            median_days=median_days,
        )

        get_submission_analytics_response_time_response_200.additional_properties = d
        return get_submission_analytics_response_time_response_200

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
