from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.update_webhook_endpoint_body_event_types_item import UpdateWebhookEndpointBodyEventTypesItem
from ..models.update_webhook_endpoint_body_status import UpdateWebhookEndpointBodyStatus
from ..types import UNSET, Unset

T = TypeVar("T", bound="UpdateWebhookEndpointBody")


@_attrs_define
class UpdateWebhookEndpointBody:
    """
    Attributes:
        url (str | Unset):
        description (str | Unset):
        event_types (list[UpdateWebhookEndpointBodyEventTypesItem] | Unset):
        status (UpdateWebhookEndpointBodyStatus | Unset):
    """

    url: str | Unset = UNSET
    description: str | Unset = UNSET
    event_types: list[UpdateWebhookEndpointBodyEventTypesItem] | Unset = UNSET
    status: UpdateWebhookEndpointBodyStatus | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        url = self.url

        description = self.description

        event_types: list[str] | Unset = UNSET
        if not isinstance(self.event_types, Unset):
            event_types = []
            for event_types_item_data in self.event_types:
                event_types_item = event_types_item_data.value
                event_types.append(event_types_item)

        status: str | Unset = UNSET
        if not isinstance(self.status, Unset):
            status = self.status.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if url is not UNSET:
            field_dict["url"] = url
        if description is not UNSET:
            field_dict["description"] = description
        if event_types is not UNSET:
            field_dict["eventTypes"] = event_types
        if status is not UNSET:
            field_dict["status"] = status

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        url = d.pop("url", UNSET)

        description = d.pop("description", UNSET)

        _event_types = d.pop("eventTypes", UNSET)
        event_types: list[UpdateWebhookEndpointBodyEventTypesItem] | Unset = UNSET
        if _event_types is not UNSET:
            event_types = []
            for event_types_item_data in _event_types:
                event_types_item = UpdateWebhookEndpointBodyEventTypesItem(event_types_item_data)

                event_types.append(event_types_item)

        _status = d.pop("status", UNSET)
        status: UpdateWebhookEndpointBodyStatus | Unset
        if isinstance(_status, Unset):
            status = UNSET
        else:
            status = UpdateWebhookEndpointBodyStatus(_status)

        update_webhook_endpoint_body = cls(
            url=url,
            description=description,
            event_types=event_types,
            status=status,
        )

        update_webhook_endpoint_body.additional_properties = d
        return update_webhook_endpoint_body

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
