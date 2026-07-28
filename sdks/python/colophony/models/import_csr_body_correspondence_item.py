from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.import_csr_body_correspondence_item_channel import ImportCsrBodyCorrespondenceItemChannel
from ..models.import_csr_body_correspondence_item_direction import ImportCsrBodyCorrespondenceItemDirection
from ..types import UNSET, Unset

T = TypeVar("T", bound="ImportCsrBodyCorrespondenceItem")


@_attrs_define
class ImportCsrBodyCorrespondenceItem:
    """
    Attributes:
        external_submission_index (int):
        direction (ImportCsrBodyCorrespondenceItemDirection):
        sent_at (datetime.datetime):
        body (str):
        channel (ImportCsrBodyCorrespondenceItemChannel | Unset):  Default:
            ImportCsrBodyCorrespondenceItemChannel.EMAIL.
        subject (str | Unset):
        sender_name (str | Unset):
        sender_email (str | Unset):
        is_personalized (bool | Unset):  Default: False.
    """

    external_submission_index: int
    direction: ImportCsrBodyCorrespondenceItemDirection
    sent_at: datetime.datetime
    body: str
    channel: ImportCsrBodyCorrespondenceItemChannel | Unset = ImportCsrBodyCorrespondenceItemChannel.EMAIL
    subject: str | Unset = UNSET
    sender_name: str | Unset = UNSET
    sender_email: str | Unset = UNSET
    is_personalized: bool | Unset = False
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        external_submission_index = self.external_submission_index

        direction = self.direction.value

        sent_at = self.sent_at.isoformat()

        body = self.body

        channel: str | Unset = UNSET
        if not isinstance(self.channel, Unset):
            channel = self.channel.value

        subject = self.subject

        sender_name = self.sender_name

        sender_email = self.sender_email

        is_personalized = self.is_personalized

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "externalSubmissionIndex": external_submission_index,
                "direction": direction,
                "sentAt": sent_at,
                "body": body,
            }
        )
        if channel is not UNSET:
            field_dict["channel"] = channel
        if subject is not UNSET:
            field_dict["subject"] = subject
        if sender_name is not UNSET:
            field_dict["senderName"] = sender_name
        if sender_email is not UNSET:
            field_dict["senderEmail"] = sender_email
        if is_personalized is not UNSET:
            field_dict["isPersonalized"] = is_personalized

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        external_submission_index = d.pop("externalSubmissionIndex")

        direction = ImportCsrBodyCorrespondenceItemDirection(d.pop("direction"))

        sent_at = datetime.datetime.fromisoformat(d.pop("sentAt"))

        body = d.pop("body")

        _channel = d.pop("channel", UNSET)
        channel: ImportCsrBodyCorrespondenceItemChannel | Unset
        if isinstance(_channel, Unset):
            channel = UNSET
        else:
            channel = ImportCsrBodyCorrespondenceItemChannel(_channel)

        subject = d.pop("subject", UNSET)

        sender_name = d.pop("senderName", UNSET)

        sender_email = d.pop("senderEmail", UNSET)

        is_personalized = d.pop("isPersonalized", UNSET)

        import_csr_body_correspondence_item = cls(
            external_submission_index=external_submission_index,
            direction=direction,
            sent_at=sent_at,
            body=body,
            channel=channel,
            subject=subject,
            sender_name=sender_name,
            sender_email=sender_email,
            is_personalized=is_personalized,
        )

        import_csr_body_correspondence_item.additional_properties = d
        return import_csr_body_correspondence_item

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
