from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast

if TYPE_CHECKING:
  from ..models.update_organization_body_settings import UpdateOrganizationBodySettings





T = TypeVar("T", bound="UpdateOrganizationBody")



@_attrs_define
class UpdateOrganizationBody:
    """ 
        Attributes:
            name (str | Unset): New display name
            settings (UpdateOrganizationBodySettings | Unset): Organization settings (max 50 keys)
     """

    name: str | Unset = UNSET
    settings: UpdateOrganizationBodySettings | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.update_organization_body_settings import UpdateOrganizationBodySettings
        name = self.name

        settings: dict[str, Any] | Unset = UNSET
        if not isinstance(self.settings, Unset):
            settings = self.settings.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if name is not UNSET:
            field_dict["name"] = name
        if settings is not UNSET:
            field_dict["settings"] = settings

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.update_organization_body_settings import UpdateOrganizationBodySettings
        d = dict(src_dict)
        name = d.pop("name", UNSET)

        _settings = d.pop("settings", UNSET)
        settings: UpdateOrganizationBodySettings | Unset
        if isinstance(_settings,  Unset):
            settings = UNSET
        else:
            settings = UpdateOrganizationBodySettings.from_dict(_settings)




        update_organization_body = cls(
            name=name,
            settings=settings,
        )


        update_organization_body.additional_properties = d
        return update_organization_body

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
