from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import Any, TypeVar, cast
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="ListNotificationsResponse200ItemsItem")


@_attrs_define
class ListNotificationsResponse200ItemsItem:
    """
    Attributes:
        id (UUID):
        event_type (str):
        title (str):
        body (None | str):
        link (None | str):
        read_at (datetime.datetime | None):
        created_at (datetime.datetime):
    """

    id: UUID
    event_type: str
    title: str
    body: None | str
    link: None | str
    read_at: datetime.datetime | None
    created_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        event_type = self.event_type

        title = self.title

        body: None | str
        body = self.body

        link: None | str
        link = self.link

        read_at: None | str
        if isinstance(self.read_at, datetime.datetime):
            read_at = self.read_at.isoformat()
        else:
            read_at = self.read_at

        created_at = self.created_at.isoformat()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "eventType": event_type,
                "title": title,
                "body": body,
                "link": link,
                "readAt": read_at,
                "createdAt": created_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))

        event_type = d.pop("eventType")

        title = d.pop("title")

        def _parse_body(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        body = _parse_body(d.pop("body"))

        def _parse_link(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        link = _parse_link(d.pop("link"))

        def _parse_read_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                read_at_type_0 = datetime.datetime.fromisoformat(data)

                return read_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        read_at = _parse_read_at(d.pop("readAt"))

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))

        list_notifications_response_200_items_item = cls(
            id=id,
            event_type=event_type,
            title=title,
            body=body,
            link=link,
            read_at=read_at,
            created_at=created_at,
        )

        list_notifications_response_200_items_item.additional_properties = d
        return list_notifications_response_200_items_item

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
