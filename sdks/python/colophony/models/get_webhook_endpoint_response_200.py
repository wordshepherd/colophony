from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import Any, TypeVar, cast
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.get_webhook_endpoint_response_200_status import GetWebhookEndpointResponse200Status

T = TypeVar("T", bound="GetWebhookEndpointResponse200")


@_attrs_define
class GetWebhookEndpointResponse200:
    """
    Attributes:
        id (UUID):
        url (str):
        description (None | str):
        event_types (list[str]):
        status (GetWebhookEndpointResponse200Status):
        created_at (datetime.datetime):
        updated_at (datetime.datetime):
    """

    id: UUID
    url: str
    description: None | str
    event_types: list[str]
    status: GetWebhookEndpointResponse200Status
    created_at: datetime.datetime
    updated_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        url = self.url

        description: None | str
        description = self.description

        event_types = self.event_types

        status = self.status.value

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "url": url,
                "description": description,
                "eventTypes": event_types,
                "status": status,
                "createdAt": created_at,
                "updatedAt": updated_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))

        url = d.pop("url")

        def _parse_description(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        description = _parse_description(d.pop("description"))

        event_types = cast(list[str], d.pop("eventTypes"))

        status = GetWebhookEndpointResponse200Status(d.pop("status"))

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))

        updated_at = datetime.datetime.fromisoformat(d.pop("updatedAt"))

        get_webhook_endpoint_response_200 = cls(
            id=id,
            url=url,
            description=description,
            event_types=event_types,
            status=status,
            created_at=created_at,
            updated_at=updated_at,
        )

        get_webhook_endpoint_response_200.additional_properties = d
        return get_webhook_endpoint_response_200

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
