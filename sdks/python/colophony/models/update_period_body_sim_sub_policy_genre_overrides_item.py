from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.update_period_body_sim_sub_policy_genre_overrides_item_genre import (
    UpdatePeriodBodySimSubPolicyGenreOverridesItemGenre,
)
from ..models.update_period_body_sim_sub_policy_genre_overrides_item_type import (
    UpdatePeriodBodySimSubPolicyGenreOverridesItemType,
)

T = TypeVar("T", bound="UpdatePeriodBodySimSubPolicyGenreOverridesItem")


@_attrs_define
class UpdatePeriodBodySimSubPolicyGenreOverridesItem:
    """
    Attributes:
        genre (UpdatePeriodBodySimSubPolicyGenreOverridesItemGenre): Primary genre classification
        type_ (UpdatePeriodBodySimSubPolicyGenreOverridesItemType):
    """

    genre: UpdatePeriodBodySimSubPolicyGenreOverridesItemGenre
    type_: UpdatePeriodBodySimSubPolicyGenreOverridesItemType
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        genre = self.genre.value

        type_ = self.type_.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "genre": genre,
                "type": type_,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        genre = UpdatePeriodBodySimSubPolicyGenreOverridesItemGenre(d.pop("genre"))

        type_ = UpdatePeriodBodySimSubPolicyGenreOverridesItemType(d.pop("type"))

        update_period_body_sim_sub_policy_genre_overrides_item = cls(
            genre=genre,
            type_=type_,
        )

        update_period_body_sim_sub_policy_genre_overrides_item.additional_properties = d
        return update_period_body_sim_sub_policy_genre_overrides_item

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
