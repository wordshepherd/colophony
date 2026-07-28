from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.get_submission_analytics_funnel_response_200_stages_item import (
        GetSubmissionAnalyticsFunnelResponse200StagesItem,
    )


T = TypeVar("T", bound="GetSubmissionAnalyticsFunnelResponse200")


@_attrs_define
class GetSubmissionAnalyticsFunnelResponse200:
    """
    Attributes:
        stages (list[GetSubmissionAnalyticsFunnelResponse200StagesItem]):
    """

    stages: list[GetSubmissionAnalyticsFunnelResponse200StagesItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        stages = []
        for stages_item_data in self.stages:
            stages_item = stages_item_data.to_dict()
            stages.append(stages_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "stages": stages,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_submission_analytics_funnel_response_200_stages_item import (
            GetSubmissionAnalyticsFunnelResponse200StagesItem,
        )

        d = dict(src_dict)
        stages = []
        _stages = d.pop("stages")
        for stages_item_data in _stages:
            stages_item = GetSubmissionAnalyticsFunnelResponse200StagesItem.from_dict(stages_item_data)

            stages.append(stages_item)

        get_submission_analytics_funnel_response_200 = cls(
            stages=stages,
        )

        get_submission_analytics_funnel_response_200.additional_properties = d
        return get_submission_analytics_funnel_response_200

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
