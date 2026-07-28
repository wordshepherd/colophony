from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.get_submission_analytics_aging_response_200_brackets_item import (
        GetSubmissionAnalyticsAgingResponse200BracketsItem,
    )


T = TypeVar("T", bound="GetSubmissionAnalyticsAgingResponse200")


@_attrs_define
class GetSubmissionAnalyticsAgingResponse200:
    """
    Attributes:
        brackets (list[GetSubmissionAnalyticsAgingResponse200BracketsItem]):
        total_aging (int):
    """

    brackets: list[GetSubmissionAnalyticsAgingResponse200BracketsItem]
    total_aging: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        brackets = []
        for brackets_item_data in self.brackets:
            brackets_item = brackets_item_data.to_dict()
            brackets.append(brackets_item)

        total_aging = self.total_aging

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "brackets": brackets,
                "totalAging": total_aging,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_submission_analytics_aging_response_200_brackets_item import (
            GetSubmissionAnalyticsAgingResponse200BracketsItem,
        )

        d = dict(src_dict)
        brackets = []
        _brackets = d.pop("brackets")
        for brackets_item_data in _brackets:
            brackets_item = GetSubmissionAnalyticsAgingResponse200BracketsItem.from_dict(brackets_item_data)

            brackets.append(brackets_item)

        total_aging = d.pop("totalAging")

        get_submission_analytics_aging_response_200 = cls(
            brackets=brackets,
            total_aging=total_aging,
        )

        get_submission_analytics_aging_response_200.additional_properties = d
        return get_submission_analytics_aging_response_200

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
