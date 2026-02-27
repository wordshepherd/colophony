from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="GetManuscriptRelatedSubmissionsResponse200Item")



@_attrs_define
class GetManuscriptRelatedSubmissionsResponse200Item:
    """ 
        Attributes:
            id (UUID): Submission ID
            organization_id (UUID): Organization ID
            status (str): Current submission status
            title (None | str): Submission title
            version_number (int): Manuscript version number used
            submitted_at (datetime.datetime | None): When the submission was submitted
     """

    id: UUID
    organization_id: UUID
    status: str
    title: None | str
    version_number: int
    submitted_at: datetime.datetime | None
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        organization_id = str(self.organization_id)

        status = self.status

        title: None | str
        title = self.title

        version_number = self.version_number

        submitted_at: None | str
        if isinstance(self.submitted_at, datetime.datetime):
            submitted_at = self.submitted_at.isoformat()
        else:
            submitted_at = self.submitted_at


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "organizationId": organization_id,
            "status": status,
            "title": title,
            "versionNumber": version_number,
            "submittedAt": submitted_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        organization_id = UUID(d.pop("organizationId"))




        status = d.pop("status")

        def _parse_title(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        title = _parse_title(d.pop("title"))


        version_number = d.pop("versionNumber")

        def _parse_submitted_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                submitted_at_type_0 = isoparse(data)



                return submitted_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        submitted_at = _parse_submitted_at(d.pop("submittedAt"))


        get_manuscript_related_submissions_response_200_item = cls(
            id=id,
            organization_id=organization_id,
            status=status,
            title=title,
            version_number=version_number,
            submitted_at=submitted_at,
        )


        get_manuscript_related_submissions_response_200_item.additional_properties = d
        return get_manuscript_related_submissions_response_200_item

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
