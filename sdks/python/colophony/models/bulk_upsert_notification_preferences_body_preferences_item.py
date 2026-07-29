from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.bulk_upsert_notification_preferences_body_preferences_item_channel import (
    BulkUpsertNotificationPreferencesBodyPreferencesItemChannel,
)
from ..models.bulk_upsert_notification_preferences_body_preferences_item_event_type import (
    BulkUpsertNotificationPreferencesBodyPreferencesItemEventType,
)

T = TypeVar("T", bound="BulkUpsertNotificationPreferencesBodyPreferencesItem")


@_attrs_define
class BulkUpsertNotificationPreferencesBodyPreferencesItem:
    """
    Attributes:
        channel (BulkUpsertNotificationPreferencesBodyPreferencesItemChannel):
        event_type (BulkUpsertNotificationPreferencesBodyPreferencesItemEventType):
        enabled (bool):
    """

    channel: BulkUpsertNotificationPreferencesBodyPreferencesItemChannel
    event_type: BulkUpsertNotificationPreferencesBodyPreferencesItemEventType
    enabled: bool
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        channel = self.channel.value

        event_type = self.event_type.value

        enabled = self.enabled

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "channel": channel,
                "eventType": event_type,
                "enabled": enabled,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        channel = BulkUpsertNotificationPreferencesBodyPreferencesItemChannel(d.pop("channel"))

        event_type = BulkUpsertNotificationPreferencesBodyPreferencesItemEventType(d.pop("eventType"))

        enabled = d.pop("enabled")

        bulk_upsert_notification_preferences_body_preferences_item = cls(
            channel=channel,
            event_type=event_type,
            enabled=enabled,
        )

        bulk_upsert_notification_preferences_body_preferences_item.additional_properties = d
        return bulk_upsert_notification_preferences_body_preferences_item

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
