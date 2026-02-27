from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.archive_publication_response_200_status import ArchivePublicationResponse200Status
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.archive_publication_response_200_settings_type_0 import ArchivePublicationResponse200SettingsType0





T = TypeVar("T", bound="ArchivePublicationResponse200")



@_attrs_define
class ArchivePublicationResponse200:
    """ 
        Attributes:
            id (UUID): Unique identifier for the publication
            organization_id (UUID): ID of the owning organization
            name (str): Display name of the publication
            slug (str): URL-friendly slug (unique per org)
            description (None | str): Optional description of the publication
            settings (ArchivePublicationResponse200SettingsType0 | None): Publication settings (default contract template,
                CMS config)
            status (ArchivePublicationResponse200Status): Current status of the publication
            created_at (datetime.datetime): When the publication was created
            updated_at (datetime.datetime): When the publication was last updated
     """

    id: UUID
    organization_id: UUID
    name: str
    slug: str
    description: None | str
    settings: ArchivePublicationResponse200SettingsType0 | None
    status: ArchivePublicationResponse200Status
    created_at: datetime.datetime
    updated_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.archive_publication_response_200_settings_type_0 import ArchivePublicationResponse200SettingsType0
        id = str(self.id)

        organization_id = str(self.organization_id)

        name = self.name

        slug = self.slug

        description: None | str
        description = self.description

        settings: dict[str, Any] | None
        if isinstance(self.settings, ArchivePublicationResponse200SettingsType0):
            settings = self.settings.to_dict()
        else:
            settings = self.settings

        status = self.status.value

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "organizationId": organization_id,
            "name": name,
            "slug": slug,
            "description": description,
            "settings": settings,
            "status": status,
            "createdAt": created_at,
            "updatedAt": updated_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.archive_publication_response_200_settings_type_0 import ArchivePublicationResponse200SettingsType0
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        organization_id = UUID(d.pop("organizationId"))




        name = d.pop("name")

        slug = d.pop("slug")

        def _parse_description(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        description = _parse_description(d.pop("description"))


        def _parse_settings(data: object) -> ArchivePublicationResponse200SettingsType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                settings_type_0 = ArchivePublicationResponse200SettingsType0.from_dict(data)



                return settings_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(ArchivePublicationResponse200SettingsType0 | None, data)

        settings = _parse_settings(d.pop("settings"))


        status = ArchivePublicationResponse200Status(d.pop("status"))




        created_at = isoparse(d.pop("createdAt"))




        updated_at = isoparse(d.pop("updatedAt"))




        archive_publication_response_200 = cls(
            id=id,
            organization_id=organization_id,
            name=name,
            slug=slug,
            description=description,
            settings=settings,
            status=status,
            created_at=created_at,
            updated_at=updated_at,
        )


        archive_publication_response_200.additional_properties = d
        return archive_publication_response_200

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
