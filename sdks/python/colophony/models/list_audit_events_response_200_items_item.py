from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="ListAuditEventsResponse200ItemsItem")



@_attrs_define
class ListAuditEventsResponse200ItemsItem:
    """ 
        Attributes:
            id (UUID): Unique identifier for the audit event
            action (str): Action that was performed (e.g. ORG_CREATED)
            resource (str): Resource type that was affected (e.g. organization)
            resource_id (None | UUID): ID of the affected resource
            actor_id (None | UUID): ID of the user who performed the action
            ip_address (None | str): IP address of the request
            user_agent (None | str): User-Agent header from the request
            request_id (None | str): Correlation ID for the request
            method (None | str): HTTP method of the request
            route (None | str): API route that was called
            created_at (datetime.datetime): When the audit event was recorded
            old_value (Any | None | Unset): Previous state before the change
            new_value (Any | None | Unset): New state after the change
     """

    id: UUID
    action: str
    resource: str
    resource_id: None | UUID
    actor_id: None | UUID
    ip_address: None | str
    user_agent: None | str
    request_id: None | str
    method: None | str
    route: None | str
    created_at: datetime.datetime
    old_value: Any | None | Unset = UNSET
    new_value: Any | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        action = self.action

        resource = self.resource

        resource_id: None | str
        if isinstance(self.resource_id, UUID):
            resource_id = str(self.resource_id)
        else:
            resource_id = self.resource_id

        actor_id: None | str
        if isinstance(self.actor_id, UUID):
            actor_id = str(self.actor_id)
        else:
            actor_id = self.actor_id

        ip_address: None | str
        ip_address = self.ip_address

        user_agent: None | str
        user_agent = self.user_agent

        request_id: None | str
        request_id = self.request_id

        method: None | str
        method = self.method

        route: None | str
        route = self.route

        created_at = self.created_at.isoformat()

        old_value: Any | None | Unset
        if isinstance(self.old_value, Unset):
            old_value = UNSET
        else:
            old_value = self.old_value

        new_value: Any | None | Unset
        if isinstance(self.new_value, Unset):
            new_value = UNSET
        else:
            new_value = self.new_value


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "action": action,
            "resource": resource,
            "resourceId": resource_id,
            "actorId": actor_id,
            "ipAddress": ip_address,
            "userAgent": user_agent,
            "requestId": request_id,
            "method": method,
            "route": route,
            "createdAt": created_at,
        })
        if old_value is not UNSET:
            field_dict["oldValue"] = old_value
        if new_value is not UNSET:
            field_dict["newValue"] = new_value

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        action = d.pop("action")

        resource = d.pop("resource")

        def _parse_resource_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                resource_id_type_0 = UUID(data)



                return resource_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        resource_id = _parse_resource_id(d.pop("resourceId"))


        def _parse_actor_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                actor_id_type_0 = UUID(data)



                return actor_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        actor_id = _parse_actor_id(d.pop("actorId"))


        def _parse_ip_address(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        ip_address = _parse_ip_address(d.pop("ipAddress"))


        def _parse_user_agent(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        user_agent = _parse_user_agent(d.pop("userAgent"))


        def _parse_request_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        request_id = _parse_request_id(d.pop("requestId"))


        def _parse_method(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        method = _parse_method(d.pop("method"))


        def _parse_route(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        route = _parse_route(d.pop("route"))


        created_at = isoparse(d.pop("createdAt"))




        def _parse_old_value(data: object) -> Any | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Any | None | Unset, data)

        old_value = _parse_old_value(d.pop("oldValue", UNSET))


        def _parse_new_value(data: object) -> Any | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Any | None | Unset, data)

        new_value = _parse_new_value(d.pop("newValue", UNSET))


        list_audit_events_response_200_items_item = cls(
            id=id,
            action=action,
            resource=resource,
            resource_id=resource_id,
            actor_id=actor_id,
            ip_address=ip_address,
            user_agent=user_agent,
            request_id=request_id,
            method=method,
            route=route,
            created_at=created_at,
            old_value=old_value,
            new_value=new_value,
        )


        list_audit_events_response_200_items_item.additional_properties = d
        return list_audit_events_response_200_items_item

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
