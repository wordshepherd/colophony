from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import Any, TypeVar, cast
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.retry_webhook_delivery_response_200_status import RetryWebhookDeliveryResponse200Status
from ..types import UNSET, Unset

T = TypeVar("T", bound="RetryWebhookDeliveryResponse200")


@_attrs_define
class RetryWebhookDeliveryResponse200:
    """
    Attributes:
        id (UUID):
        webhook_endpoint_id (UUID):
        event_type (str):
        event_id (str):
        status (RetryWebhookDeliveryResponse200Status):
        http_status_code (float | None):
        response_body (None | str):
        error_message (None | str):
        attempts (float):
        next_retry_at (datetime.datetime | None):
        delivered_at (datetime.datetime | None):
        created_at (datetime.datetime):
        payload (Any | Unset):
    """

    id: UUID
    webhook_endpoint_id: UUID
    event_type: str
    event_id: str
    status: RetryWebhookDeliveryResponse200Status
    http_status_code: float | None
    response_body: None | str
    error_message: None | str
    attempts: float
    next_retry_at: datetime.datetime | None
    delivered_at: datetime.datetime | None
    created_at: datetime.datetime
    payload: Any | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        webhook_endpoint_id = str(self.webhook_endpoint_id)

        event_type = self.event_type

        event_id = self.event_id

        status = self.status.value

        http_status_code: float | None
        http_status_code = self.http_status_code

        response_body: None | str
        response_body = self.response_body

        error_message: None | str
        error_message = self.error_message

        attempts = self.attempts

        next_retry_at: None | str
        if isinstance(self.next_retry_at, datetime.datetime):
            next_retry_at = self.next_retry_at.isoformat()
        else:
            next_retry_at = self.next_retry_at

        delivered_at: None | str
        if isinstance(self.delivered_at, datetime.datetime):
            delivered_at = self.delivered_at.isoformat()
        else:
            delivered_at = self.delivered_at

        created_at = self.created_at.isoformat()

        payload = self.payload

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "webhookEndpointId": webhook_endpoint_id,
                "eventType": event_type,
                "eventId": event_id,
                "status": status,
                "httpStatusCode": http_status_code,
                "responseBody": response_body,
                "errorMessage": error_message,
                "attempts": attempts,
                "nextRetryAt": next_retry_at,
                "deliveredAt": delivered_at,
                "createdAt": created_at,
            }
        )
        if payload is not UNSET:
            field_dict["payload"] = payload

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))

        webhook_endpoint_id = UUID(d.pop("webhookEndpointId"))

        event_type = d.pop("eventType")

        event_id = d.pop("eventId")

        status = RetryWebhookDeliveryResponse200Status(d.pop("status"))

        def _parse_http_status_code(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        http_status_code = _parse_http_status_code(d.pop("httpStatusCode"))

        def _parse_response_body(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        response_body = _parse_response_body(d.pop("responseBody"))

        def _parse_error_message(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        error_message = _parse_error_message(d.pop("errorMessage"))

        attempts = d.pop("attempts")

        def _parse_next_retry_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                next_retry_at_type_0 = datetime.datetime.fromisoformat(data)

                return next_retry_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        next_retry_at = _parse_next_retry_at(d.pop("nextRetryAt"))

        def _parse_delivered_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                delivered_at_type_0 = datetime.datetime.fromisoformat(data)

                return delivered_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        delivered_at = _parse_delivered_at(d.pop("deliveredAt"))

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))

        payload = d.pop("payload", UNSET)

        retry_webhook_delivery_response_200 = cls(
            id=id,
            webhook_endpoint_id=webhook_endpoint_id,
            event_type=event_type,
            event_id=event_id,
            status=status,
            http_status_code=http_status_code,
            response_body=response_body,
            error_message=error_message,
            attempts=attempts,
            next_retry_at=next_retry_at,
            delivered_at=delivered_at,
            created_at=created_at,
            payload=payload,
        )

        retry_webhook_delivery_response_200.additional_properties = d
        return retry_webhook_delivery_response_200

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
