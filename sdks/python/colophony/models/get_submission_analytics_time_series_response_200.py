from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.get_submission_analytics_time_series_response_200_granularity import (
    GetSubmissionAnalyticsTimeSeriesResponse200Granularity,
)

if TYPE_CHECKING:
    from ..models.get_submission_analytics_time_series_response_200_points_item import (
        GetSubmissionAnalyticsTimeSeriesResponse200PointsItem,
    )


T = TypeVar("T", bound="GetSubmissionAnalyticsTimeSeriesResponse200")


@_attrs_define
class GetSubmissionAnalyticsTimeSeriesResponse200:
    """
    Attributes:
        granularity (GetSubmissionAnalyticsTimeSeriesResponse200Granularity):
        points (list[GetSubmissionAnalyticsTimeSeriesResponse200PointsItem]):
    """

    granularity: GetSubmissionAnalyticsTimeSeriesResponse200Granularity
    points: list[GetSubmissionAnalyticsTimeSeriesResponse200PointsItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        granularity = self.granularity.value

        points = []
        for points_item_data in self.points:
            points_item = points_item_data.to_dict()
            points.append(points_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "granularity": granularity,
                "points": points,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_submission_analytics_time_series_response_200_points_item import (
            GetSubmissionAnalyticsTimeSeriesResponse200PointsItem,
        )

        d = dict(src_dict)
        granularity = GetSubmissionAnalyticsTimeSeriesResponse200Granularity(d.pop("granularity"))

        points = []
        _points = d.pop("points")
        for points_item_data in _points:
            points_item = GetSubmissionAnalyticsTimeSeriesResponse200PointsItem.from_dict(points_item_data)

            points.append(points_item)

        get_submission_analytics_time_series_response_200 = cls(
            granularity=granularity,
            points=points,
        )

        get_submission_analytics_time_series_response_200.additional_properties = d
        return get_submission_analytics_time_series_response_200

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
