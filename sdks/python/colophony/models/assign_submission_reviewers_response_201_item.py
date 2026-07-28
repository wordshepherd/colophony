from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import Any, TypeVar, cast
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.assign_submission_reviewers_response_201_item_reviewer_role import (
    AssignSubmissionReviewersResponse201ItemReviewerRole,
)

T = TypeVar("T", bound="AssignSubmissionReviewersResponse201Item")


@_attrs_define
class AssignSubmissionReviewersResponse201Item:
    """
    Attributes:
        id (UUID):
        submission_id (UUID):
        reviewer_user_id (UUID):
        reviewer_email (None | str):
        reviewer_role (AssignSubmissionReviewersResponse201ItemReviewerRole):
        assigned_by (None | UUID):
        assigned_at (datetime.datetime):
        read_at (datetime.datetime | None):
    """

    id: UUID
    submission_id: UUID
    reviewer_user_id: UUID
    reviewer_email: None | str
    reviewer_role: AssignSubmissionReviewersResponse201ItemReviewerRole
    assigned_by: None | UUID
    assigned_at: datetime.datetime
    read_at: datetime.datetime | None
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        submission_id = str(self.submission_id)

        reviewer_user_id = str(self.reviewer_user_id)

        reviewer_email: None | str
        reviewer_email = self.reviewer_email

        reviewer_role = self.reviewer_role.value

        assigned_by: None | str
        if isinstance(self.assigned_by, UUID):
            assigned_by = str(self.assigned_by)
        else:
            assigned_by = self.assigned_by

        assigned_at = self.assigned_at.isoformat()

        read_at: None | str
        if isinstance(self.read_at, datetime.datetime):
            read_at = self.read_at.isoformat()
        else:
            read_at = self.read_at

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "submissionId": submission_id,
                "reviewerUserId": reviewer_user_id,
                "reviewerEmail": reviewer_email,
                "reviewerRole": reviewer_role,
                "assignedBy": assigned_by,
                "assignedAt": assigned_at,
                "readAt": read_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))

        submission_id = UUID(d.pop("submissionId"))

        reviewer_user_id = UUID(d.pop("reviewerUserId"))

        def _parse_reviewer_email(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        reviewer_email = _parse_reviewer_email(d.pop("reviewerEmail"))

        reviewer_role = AssignSubmissionReviewersResponse201ItemReviewerRole(d.pop("reviewerRole"))

        def _parse_assigned_by(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                assigned_by_type_0 = UUID(data)

                return assigned_by_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        assigned_by = _parse_assigned_by(d.pop("assignedBy"))

        assigned_at = datetime.datetime.fromisoformat(d.pop("assignedAt"))

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

        assign_submission_reviewers_response_201_item = cls(
            id=id,
            submission_id=submission_id,
            reviewer_user_id=reviewer_user_id,
            reviewer_email=reviewer_email,
            reviewer_role=reviewer_role,
            assigned_by=assigned_by,
            assigned_at=assigned_at,
            read_at=read_at,
        )

        assign_submission_reviewers_response_201_item.additional_properties = d
        return assign_submission_reviewers_response_201_item

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
