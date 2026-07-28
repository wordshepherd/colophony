from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="GetSubmissionAnalyticsOverviewResponse200")


@_attrs_define
class GetSubmissionAnalyticsOverviewResponse200:
    """
    Attributes:
        total_submissions (int):
        acceptance_rate (float):
        avg_response_time_days (float | None):
        pending_count (int):
        submissions_this_month (int):
        submissions_last_month (int):
    """

    total_submissions: int
    acceptance_rate: float
    avg_response_time_days: float | None
    pending_count: int
    submissions_this_month: int
    submissions_last_month: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        total_submissions = self.total_submissions

        acceptance_rate = self.acceptance_rate

        avg_response_time_days: float | None
        avg_response_time_days = self.avg_response_time_days

        pending_count = self.pending_count

        submissions_this_month = self.submissions_this_month

        submissions_last_month = self.submissions_last_month

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "totalSubmissions": total_submissions,
                "acceptanceRate": acceptance_rate,
                "avgResponseTimeDays": avg_response_time_days,
                "pendingCount": pending_count,
                "submissionsThisMonth": submissions_this_month,
                "submissionsLastMonth": submissions_last_month,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        total_submissions = d.pop("totalSubmissions")

        acceptance_rate = d.pop("acceptanceRate")

        def _parse_avg_response_time_days(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        avg_response_time_days = _parse_avg_response_time_days(d.pop("avgResponseTimeDays"))

        pending_count = d.pop("pendingCount")

        submissions_this_month = d.pop("submissionsThisMonth")

        submissions_last_month = d.pop("submissionsLastMonth")

        get_submission_analytics_overview_response_200 = cls(
            total_submissions=total_submissions,
            acceptance_rate=acceptance_rate,
            avg_response_time_days=avg_response_time_days,
            pending_count=pending_count,
            submissions_this_month=submissions_this_month,
            submissions_last_month=submissions_last_month,
        )

        get_submission_analytics_overview_response_200.additional_properties = d
        return get_submission_analytics_overview_response_200

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
