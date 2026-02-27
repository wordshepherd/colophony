from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast

if TYPE_CHECKING:
  from ..models.update_publication_body_settings_type_0 import UpdatePublicationBodySettingsType0





T = TypeVar("T", bound="UpdatePublicationBody")



@_attrs_define
class UpdatePublicationBody:
    """ 
        Attributes:
            name (str | Unset): New display name
            slug (str | Unset): New URL-friendly slug
            description (None | str | Unset): New description (null to clear)
            settings (None | Unset | UpdatePublicationBodySettingsType0): New settings (null to clear)
     """

    name: str | Unset = UNSET
    slug: str | Unset = UNSET
    description: None | str | Unset = UNSET
    settings: None | Unset | UpdatePublicationBodySettingsType0 = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.update_publication_body_settings_type_0 import UpdatePublicationBodySettingsType0
        name = self.name

        slug = self.slug

        description: None | str | Unset
        if isinstance(self.description, Unset):
            description = UNSET
        else:
            description = self.description

        settings: dict[str, Any] | None | Unset
        if isinstance(self.settings, Unset):
            settings = UNSET
        elif isinstance(self.settings, UpdatePublicationBodySettingsType0):
            settings = self.settings.to_dict()
        else:
            settings = self.settings


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if name is not UNSET:
            field_dict["name"] = name
        if slug is not UNSET:
            field_dict["slug"] = slug
        if description is not UNSET:
            field_dict["description"] = description
        if settings is not UNSET:
            field_dict["settings"] = settings

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.update_publication_body_settings_type_0 import UpdatePublicationBodySettingsType0
        d = dict(src_dict)
        name = d.pop("name", UNSET)

        slug = d.pop("slug", UNSET)

        def _parse_description(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        description = _parse_description(d.pop("description", UNSET))


        def _parse_settings(data: object) -> None | Unset | UpdatePublicationBodySettingsType0:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                settings_type_0 = UpdatePublicationBodySettingsType0.from_dict(data)



                return settings_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Unset | UpdatePublicationBodySettingsType0, data)

        settings = _parse_settings(d.pop("settings", UNSET))


        update_publication_body = cls(
            name=name,
            slug=slug,
            description=description,
            settings=settings,
        )


        update_publication_body.additional_properties = d
        return update_publication_body

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
