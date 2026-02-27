from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.update_cms_connection_response_200_adapter_type import UpdateCmsConnectionResponse200AdapterType
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.update_cms_connection_response_200_config import UpdateCmsConnectionResponse200Config





T = TypeVar("T", bound="UpdateCmsConnectionResponse200")



@_attrs_define
class UpdateCmsConnectionResponse200:
    """ 
        Attributes:
            id (UUID):
            organization_id (UUID):
            publication_id (None | UUID):
            adapter_type (UpdateCmsConnectionResponse200AdapterType):
            name (str):
            config (UpdateCmsConnectionResponse200Config):
            is_active (bool):
            last_sync_at (datetime.datetime | None):
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
     """

    id: UUID
    organization_id: UUID
    publication_id: None | UUID
    adapter_type: UpdateCmsConnectionResponse200AdapterType
    name: str
    config: UpdateCmsConnectionResponse200Config
    is_active: bool
    last_sync_at: datetime.datetime | None
    created_at: datetime.datetime
    updated_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.update_cms_connection_response_200_config import UpdateCmsConnectionResponse200Config
        id = str(self.id)

        organization_id = str(self.organization_id)

        publication_id: None | str
        if isinstance(self.publication_id, UUID):
            publication_id = str(self.publication_id)
        else:
            publication_id = self.publication_id

        adapter_type = self.adapter_type.value

        name = self.name

        config = self.config.to_dict()

        is_active = self.is_active

        last_sync_at: None | str
        if isinstance(self.last_sync_at, datetime.datetime):
            last_sync_at = self.last_sync_at.isoformat()
        else:
            last_sync_at = self.last_sync_at

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "organizationId": organization_id,
            "publicationId": publication_id,
            "adapterType": adapter_type,
            "name": name,
            "config": config,
            "isActive": is_active,
            "lastSyncAt": last_sync_at,
            "createdAt": created_at,
            "updatedAt": updated_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.update_cms_connection_response_200_config import UpdateCmsConnectionResponse200Config
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        organization_id = UUID(d.pop("organizationId"))




        def _parse_publication_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                publication_id_type_0 = UUID(data)



                return publication_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        publication_id = _parse_publication_id(d.pop("publicationId"))


        adapter_type = UpdateCmsConnectionResponse200AdapterType(d.pop("adapterType"))




        name = d.pop("name")

        config = UpdateCmsConnectionResponse200Config.from_dict(d.pop("config"))




        is_active = d.pop("isActive")

        def _parse_last_sync_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_sync_at_type_0 = isoparse(data)



                return last_sync_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        last_sync_at = _parse_last_sync_at(d.pop("lastSyncAt"))


        created_at = isoparse(d.pop("createdAt"))




        updated_at = isoparse(d.pop("updatedAt"))




        update_cms_connection_response_200 = cls(
            id=id,
            organization_id=organization_id,
            publication_id=publication_id,
            adapter_type=adapter_type,
            name=name,
            config=config,
            is_active=is_active,
            last_sync_at=last_sync_at,
            created_at=created_at,
            updated_at=updated_at,
        )


        update_cms_connection_response_200.additional_properties = d
        return update_cms_connection_response_200

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
