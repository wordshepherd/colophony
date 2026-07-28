from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import Any, TypeVar, cast
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.export_csr_response_200_correspondence_item_channel import ExportCsrResponse200CorrespondenceItemChannel
from ..models.export_csr_response_200_correspondence_item_direction import (
    ExportCsrResponse200CorrespondenceItemDirection,
)
from ..models.export_csr_response_200_correspondence_item_source import ExportCsrResponse200CorrespondenceItemSource

T = TypeVar("T", bound="ExportCsrResponse200CorrespondenceItem")


@_attrs_define
class ExportCsrResponse200CorrespondenceItem:
    """Editor-writer correspondence record

    Attributes:
        id (UUID):
        submission_id (None | UUID):
        external_submission_id (None | UUID):
        direction (ExportCsrResponse200CorrespondenceItemDirection):
        channel (ExportCsrResponse200CorrespondenceItemChannel):
        sent_at (datetime.datetime):
        subject (None | str):
        body (str):
        sender_name (None | str):
        sender_email (None | str):
        is_personalized (bool):
        source (ExportCsrResponse200CorrespondenceItemSource):
        captured_at (datetime.datetime):
    """

    id: UUID
    submission_id: None | UUID
    external_submission_id: None | UUID
    direction: ExportCsrResponse200CorrespondenceItemDirection
    channel: ExportCsrResponse200CorrespondenceItemChannel
    sent_at: datetime.datetime
    subject: None | str
    body: str
    sender_name: None | str
    sender_email: None | str
    is_personalized: bool
    source: ExportCsrResponse200CorrespondenceItemSource
    captured_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        submission_id: None | str
        if isinstance(self.submission_id, UUID):
            submission_id = str(self.submission_id)
        else:
            submission_id = self.submission_id

        external_submission_id: None | str
        if isinstance(self.external_submission_id, UUID):
            external_submission_id = str(self.external_submission_id)
        else:
            external_submission_id = self.external_submission_id

        direction = self.direction.value

        channel = self.channel.value

        sent_at = self.sent_at.isoformat()

        subject: None | str
        subject = self.subject

        body = self.body

        sender_name: None | str
        sender_name = self.sender_name

        sender_email: None | str
        sender_email = self.sender_email

        is_personalized = self.is_personalized

        source = self.source.value

        captured_at = self.captured_at.isoformat()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "submissionId": submission_id,
                "externalSubmissionId": external_submission_id,
                "direction": direction,
                "channel": channel,
                "sentAt": sent_at,
                "subject": subject,
                "body": body,
                "senderName": sender_name,
                "senderEmail": sender_email,
                "isPersonalized": is_personalized,
                "source": source,
                "capturedAt": captured_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))

        def _parse_submission_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                submission_id_type_0 = UUID(data)

                return submission_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        submission_id = _parse_submission_id(d.pop("submissionId"))

        def _parse_external_submission_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                external_submission_id_type_0 = UUID(data)

                return external_submission_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        external_submission_id = _parse_external_submission_id(d.pop("externalSubmissionId"))

        direction = ExportCsrResponse200CorrespondenceItemDirection(d.pop("direction"))

        channel = ExportCsrResponse200CorrespondenceItemChannel(d.pop("channel"))

        sent_at = datetime.datetime.fromisoformat(d.pop("sentAt"))

        def _parse_subject(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        subject = _parse_subject(d.pop("subject"))

        body = d.pop("body")

        def _parse_sender_name(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        sender_name = _parse_sender_name(d.pop("senderName"))

        def _parse_sender_email(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        sender_email = _parse_sender_email(d.pop("senderEmail"))

        is_personalized = d.pop("isPersonalized")

        source = ExportCsrResponse200CorrespondenceItemSource(d.pop("source"))

        captured_at = datetime.datetime.fromisoformat(d.pop("capturedAt"))

        export_csr_response_200_correspondence_item = cls(
            id=id,
            submission_id=submission_id,
            external_submission_id=external_submission_id,
            direction=direction,
            channel=channel,
            sent_at=sent_at,
            subject=subject,
            body=body,
            sender_name=sender_name,
            sender_email=sender_email,
            is_personalized=is_personalized,
            source=source,
            captured_at=captured_at,
        )

        export_csr_response_200_correspondence_item.additional_properties = d
        return export_csr_response_200_correspondence_item

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
