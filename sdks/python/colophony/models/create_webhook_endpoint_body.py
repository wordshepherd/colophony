from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.create_webhook_endpoint_body_event_types_item import CreateWebhookEndpointBodyEventTypesItem
from ..types import UNSET, Unset

T = TypeVar("T", bound="CreateWebhookEndpointBody")


@_attrs_define
class CreateWebhookEndpointBody:
    """
    Attributes:
        url (str):
        event_types (list[CreateWebhookEndpointBodyEventTypesItem]):
        description (str | Unset):
    """

    url: str
    event_types: list[CreateWebhookEndpointBodyEventTypesItem]
    description: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        url = self.url

        event_types = []
        for event_types_item_data in self.event_types:
            event_types_item = event_types_item_data.value
            event_types.append(event_types_item)

        description = self.description

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "url": url,
                "eventTypes": event_types,
            }
        )
        if description is not UNSET:
            field_dict["description"] = description

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        url = d.pop("url")

        event_types = []
        _event_types = d.pop("eventTypes")
        for event_types_item_data in _event_types:
            event_types_item = CreateWebhookEndpointBodyEventTypesItem(event_types_item_data)

            event_types.append(event_types_item)

        description = d.pop("description", UNSET)

        create_webhook_endpoint_body = cls(
            url=url,
            event_types=event_types,
            description=description,
        )

        create_webhook_endpoint_body.additional_properties = d
        return create_webhook_endpoint_body

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
