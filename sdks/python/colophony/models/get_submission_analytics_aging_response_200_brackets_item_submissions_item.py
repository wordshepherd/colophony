from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import Any, TypeVar, cast
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="GetSubmissionAnalyticsAgingResponse200BracketsItemSubmissionsItem")


@_attrs_define
class GetSubmissionAnalyticsAgingResponse200BracketsItemSubmissionsItem:
    """
    Attributes:
        id (UUID):
        title (None | str):
        status (str):
        submitted_at (datetime.datetime | None):
        days_pending (int):
    """

    id: UUID
    title: None | str
    status: str
    submitted_at: datetime.datetime | None
    days_pending: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        title: None | str
        title = self.title

        status = self.status

        submitted_at: None | str
        if isinstance(self.submitted_at, datetime.datetime):
            submitted_at = self.submitted_at.isoformat()
        else:
            submitted_at = self.submitted_at

        days_pending = self.days_pending

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "title": title,
                "status": status,
                "submittedAt": submitted_at,
                "daysPending": days_pending,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))

        def _parse_title(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        title = _parse_title(d.pop("title"))

        status = d.pop("status")

        def _parse_submitted_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                submitted_at_type_0 = datetime.datetime.fromisoformat(data)

                return submitted_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        submitted_at = _parse_submitted_at(d.pop("submittedAt"))

        days_pending = d.pop("daysPending")

        get_submission_analytics_aging_response_200_brackets_item_submissions_item = cls(
            id=id,
            title=title,
            status=status,
            submitted_at=submitted_at,
            days_pending=days_pending,
        )

        get_submission_analytics_aging_response_200_brackets_item_submissions_item.additional_properties = d
        return get_submission_analytics_aging_response_200_brackets_item_submissions_item

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
