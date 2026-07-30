from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import Any, TypeVar
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.upsert_notification_preference_response_200_channel import UpsertNotificationPreferenceResponse200Channel

T = TypeVar("T", bound="UpsertNotificationPreferenceResponse200")


@_attrs_define
class UpsertNotificationPreferenceResponse200:
    """
    Attributes:
        id (UUID):
        channel (UpsertNotificationPreferenceResponse200Channel):
        event_type (str):
        enabled (bool):
        created_at (datetime.datetime):
        updated_at (datetime.datetime):
    """

    id: UUID
    channel: UpsertNotificationPreferenceResponse200Channel
    event_type: str
    enabled: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        channel = self.channel.value

        event_type = self.event_type

        enabled = self.enabled

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "channel": channel,
                "eventType": event_type,
                "enabled": enabled,
                "createdAt": created_at,
                "updatedAt": updated_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))

        channel = UpsertNotificationPreferenceResponse200Channel(d.pop("channel"))

        event_type = d.pop("eventType")

        enabled = d.pop("enabled")

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))

        updated_at = datetime.datetime.fromisoformat(d.pop("updatedAt"))

        upsert_notification_preference_response_200 = cls(
            id=id,
            channel=channel,
            event_type=event_type,
            enabled=enabled,
            created_at=created_at,
            updated_at=updated_at,
        )

        upsert_notification_preference_response_200.additional_properties = d
        return upsert_notification_preference_response_200

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
