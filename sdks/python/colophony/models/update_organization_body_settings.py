from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.update_organization_body_settings_additional_property_type_4 import (
        UpdateOrganizationBodySettingsAdditionalPropertyType4,
    )


T = TypeVar("T", bound="UpdateOrganizationBodySettings")


@_attrs_define
class UpdateOrganizationBodySettings:
    """Organization settings (max 50 keys)"""

    additional_properties: dict[
        str, bool | float | None | str | UpdateOrganizationBodySettingsAdditionalPropertyType4
    ] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.update_organization_body_settings_additional_property_type_4 import (
            UpdateOrganizationBodySettingsAdditionalPropertyType4,
        )

        field_dict: dict[str, Any] = {}
        for prop_name, prop in self.additional_properties.items():
            if isinstance(prop, UpdateOrganizationBodySettingsAdditionalPropertyType4):
                field_dict[prop_name] = prop.to_dict()
            else:
                field_dict[prop_name] = prop

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.update_organization_body_settings_additional_property_type_4 import (
            UpdateOrganizationBodySettingsAdditionalPropertyType4,
        )

        d = dict(src_dict)
        update_organization_body_settings = cls()

        additional_properties = {}
        for prop_name, prop_dict in d.items():

            def _parse_additional_property(
                data: object,
            ) -> bool | float | None | str | UpdateOrganizationBodySettingsAdditionalPropertyType4:
                if data is None:
                    return data
                try:
                    if not isinstance(data, dict):
                        raise TypeError()
                    additional_property_type_4 = UpdateOrganizationBodySettingsAdditionalPropertyType4.from_dict(data)

                    return additional_property_type_4
                except (TypeError, ValueError, AttributeError, KeyError):
                    pass
                return cast(bool | float | None | str | UpdateOrganizationBodySettingsAdditionalPropertyType4, data)

            additional_property = _parse_additional_property(prop_dict)

            additional_properties[prop_name] = additional_property

        update_organization_body_settings.additional_properties = additional_properties
        return update_organization_body_settings

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(
        self, key: str
    ) -> bool | float | None | str | UpdateOrganizationBodySettingsAdditionalPropertyType4:
        return self.additional_properties[key]

    def __setitem__(
        self, key: str, value: bool | float | None | str | UpdateOrganizationBodySettingsAdditionalPropertyType4
    ) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
