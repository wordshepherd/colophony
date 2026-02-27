from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast

if TYPE_CHECKING:
  from ..models.create_publication_body_settings import CreatePublicationBodySettings





T = TypeVar("T", bound="CreatePublicationBody")



@_attrs_define
class CreatePublicationBody:
    """ 
        Attributes:
            name (str): Display name for the publication
            slug (str): URL-friendly slug (lowercase alphanumeric + hyphens)
            description (str | Unset): Description of the publication (max 2,000 chars)
            settings (CreatePublicationBodySettings | Unset): Publication settings
     """

    name: str
    slug: str
    description: str | Unset = UNSET
    settings: CreatePublicationBodySettings | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.create_publication_body_settings import CreatePublicationBodySettings
        name = self.name

        slug = self.slug

        description = self.description

        settings: dict[str, Any] | Unset = UNSET
        if not isinstance(self.settings, Unset):
            settings = self.settings.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "name": name,
            "slug": slug,
        })
        if description is not UNSET:
            field_dict["description"] = description
        if settings is not UNSET:
            field_dict["settings"] = settings

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.create_publication_body_settings import CreatePublicationBodySettings
        d = dict(src_dict)
        name = d.pop("name")

        slug = d.pop("slug")

        description = d.pop("description", UNSET)

        _settings = d.pop("settings", UNSET)
        settings: CreatePublicationBodySettings | Unset
        if isinstance(_settings,  Unset):
            settings = UNSET
        else:
            settings = CreatePublicationBodySettings.from_dict(_settings)




        create_publication_body = cls(
            name=name,
            slug=slug,
            description=description,
            settings=settings,
        )


        create_publication_body.additional_properties = d
        return create_publication_body

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
