from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.get_period_response_200_sim_sub_policy_type import GetPeriodResponse200SimSubPolicyType
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.get_period_response_200_sim_sub_policy_genre_overrides_item import (
        GetPeriodResponse200SimSubPolicyGenreOverridesItem,
    )


T = TypeVar("T", bound="GetPeriodResponse200SimSubPolicy")


@_attrs_define
class GetPeriodResponse200SimSubPolicy:
    """Sim-sub policy for this period

    Attributes:
        type_ (GetPeriodResponse200SimSubPolicyType):
        notify_window_hours (int | Unset):
        genre_overrides (list[GetPeriodResponse200SimSubPolicyGenreOverridesItem] | Unset):
        notes (str | Unset):
    """

    type_: GetPeriodResponse200SimSubPolicyType
    notify_window_hours: int | Unset = UNSET
    genre_overrides: list[GetPeriodResponse200SimSubPolicyGenreOverridesItem] | Unset = UNSET
    notes: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_.value

        notify_window_hours = self.notify_window_hours

        genre_overrides: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.genre_overrides, Unset):
            genre_overrides = []
            for genre_overrides_item_data in self.genre_overrides:
                genre_overrides_item = genre_overrides_item_data.to_dict()
                genre_overrides.append(genre_overrides_item)

        notes = self.notes

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "type": type_,
            }
        )
        if notify_window_hours is not UNSET:
            field_dict["notifyWindowHours"] = notify_window_hours
        if genre_overrides is not UNSET:
            field_dict["genreOverrides"] = genre_overrides
        if notes is not UNSET:
            field_dict["notes"] = notes

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_period_response_200_sim_sub_policy_genre_overrides_item import (
            GetPeriodResponse200SimSubPolicyGenreOverridesItem,
        )

        d = dict(src_dict)
        type_ = GetPeriodResponse200SimSubPolicyType(d.pop("type"))

        notify_window_hours = d.pop("notifyWindowHours", UNSET)

        _genre_overrides = d.pop("genreOverrides", UNSET)
        genre_overrides: list[GetPeriodResponse200SimSubPolicyGenreOverridesItem] | Unset = UNSET
        if _genre_overrides is not UNSET:
            genre_overrides = []
            for genre_overrides_item_data in _genre_overrides:
                genre_overrides_item = GetPeriodResponse200SimSubPolicyGenreOverridesItem.from_dict(
                    genre_overrides_item_data
                )

                genre_overrides.append(genre_overrides_item)

        notes = d.pop("notes", UNSET)

        get_period_response_200_sim_sub_policy = cls(
            type_=type_,
            notify_window_hours=notify_window_hours,
            genre_overrides=genre_overrides,
            notes=notes,
        )

        get_period_response_200_sim_sub_policy.additional_properties = d
        return get_period_response_200_sim_sub_policy

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
