from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import Any, TypeVar, cast
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="AddSubmissionDiscussionResponse200")


@_attrs_define
class AddSubmissionDiscussionResponse200:
    """
    Attributes:
        id (UUID):
        submission_id (UUID):
        author_id (None | UUID):
        author_email (None | str):
        parent_id (None | UUID):
        content (str):
        created_at (datetime.datetime):
        updated_at (datetime.datetime | None):
    """

    id: UUID
    submission_id: UUID
    author_id: None | UUID
    author_email: None | str
    parent_id: None | UUID
    content: str
    created_at: datetime.datetime
    updated_at: datetime.datetime | None
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        submission_id = str(self.submission_id)

        author_id: None | str
        if isinstance(self.author_id, UUID):
            author_id = str(self.author_id)
        else:
            author_id = self.author_id

        author_email: None | str
        author_email = self.author_email

        parent_id: None | str
        if isinstance(self.parent_id, UUID):
            parent_id = str(self.parent_id)
        else:
            parent_id = self.parent_id

        content = self.content

        created_at = self.created_at.isoformat()

        updated_at: None | str
        if isinstance(self.updated_at, datetime.datetime):
            updated_at = self.updated_at.isoformat()
        else:
            updated_at = self.updated_at

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "submissionId": submission_id,
                "authorId": author_id,
                "authorEmail": author_email,
                "parentId": parent_id,
                "content": content,
                "createdAt": created_at,
                "updatedAt": updated_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))

        submission_id = UUID(d.pop("submissionId"))

        def _parse_author_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                author_id_type_0 = UUID(data)

                return author_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        author_id = _parse_author_id(d.pop("authorId"))

        def _parse_author_email(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        author_email = _parse_author_email(d.pop("authorEmail"))

        def _parse_parent_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                parent_id_type_0 = UUID(data)

                return parent_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        parent_id = _parse_parent_id(d.pop("parentId"))

        content = d.pop("content")

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))

        def _parse_updated_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                updated_at_type_0 = datetime.datetime.fromisoformat(data)

                return updated_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        updated_at = _parse_updated_at(d.pop("updatedAt"))

        add_submission_discussion_response_200 = cls(
            id=id,
            submission_id=submission_id,
            author_id=author_id,
            author_email=author_email,
            parent_id=parent_id,
            content=content,
            created_at=created_at,
            updated_at=updated_at,
        )

        add_submission_discussion_response_200.additional_properties = d
        return add_submission_discussion_response_200

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
