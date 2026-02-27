from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.get_issue_response_200_status import GetIssueResponse200Status
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.get_issue_response_200_metadata_type_0 import GetIssueResponse200MetadataType0





T = TypeVar("T", bound="GetIssueResponse200")



@_attrs_define
class GetIssueResponse200:
    """ 
        Attributes:
            id (UUID): Issue ID
            organization_id (UUID): Organization ID
            publication_id (UUID): Publication ID
            title (str): Issue title
            volume (int | None): Volume number
            issue_number (int | None): Issue number
            description (None | str): Issue description
            cover_image_url (None | str): Cover image URL
            status (GetIssueResponse200Status): Current status of the issue
            publication_date (datetime.datetime | None): Scheduled publication date
            published_at (datetime.datetime | None): Actual publish timestamp
            metadata (GetIssueResponse200MetadataType0 | None): Metadata
            created_at (datetime.datetime): When the issue was created
            updated_at (datetime.datetime): When the issue was last updated
     """

    id: UUID
    organization_id: UUID
    publication_id: UUID
    title: str
    volume: int | None
    issue_number: int | None
    description: None | str
    cover_image_url: None | str
    status: GetIssueResponse200Status
    publication_date: datetime.datetime | None
    published_at: datetime.datetime | None
    metadata: GetIssueResponse200MetadataType0 | None
    created_at: datetime.datetime
    updated_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.get_issue_response_200_metadata_type_0 import GetIssueResponse200MetadataType0
        id = str(self.id)

        organization_id = str(self.organization_id)

        publication_id = str(self.publication_id)

        title = self.title

        volume: int | None
        volume = self.volume

        issue_number: int | None
        issue_number = self.issue_number

        description: None | str
        description = self.description

        cover_image_url: None | str
        cover_image_url = self.cover_image_url

        status = self.status.value

        publication_date: None | str
        if isinstance(self.publication_date, datetime.datetime):
            publication_date = self.publication_date.isoformat()
        else:
            publication_date = self.publication_date

        published_at: None | str
        if isinstance(self.published_at, datetime.datetime):
            published_at = self.published_at.isoformat()
        else:
            published_at = self.published_at

        metadata: dict[str, Any] | None
        if isinstance(self.metadata, GetIssueResponse200MetadataType0):
            metadata = self.metadata.to_dict()
        else:
            metadata = self.metadata

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "organizationId": organization_id,
            "publicationId": publication_id,
            "title": title,
            "volume": volume,
            "issueNumber": issue_number,
            "description": description,
            "coverImageUrl": cover_image_url,
            "status": status,
            "publicationDate": publication_date,
            "publishedAt": published_at,
            "metadata": metadata,
            "createdAt": created_at,
            "updatedAt": updated_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_issue_response_200_metadata_type_0 import GetIssueResponse200MetadataType0
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        organization_id = UUID(d.pop("organizationId"))




        publication_id = UUID(d.pop("publicationId"))




        title = d.pop("title")

        def _parse_volume(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        volume = _parse_volume(d.pop("volume"))


        def _parse_issue_number(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        issue_number = _parse_issue_number(d.pop("issueNumber"))


        def _parse_description(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        description = _parse_description(d.pop("description"))


        def _parse_cover_image_url(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        cover_image_url = _parse_cover_image_url(d.pop("coverImageUrl"))


        status = GetIssueResponse200Status(d.pop("status"))




        def _parse_publication_date(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                publication_date_type_0 = isoparse(data)



                return publication_date_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        publication_date = _parse_publication_date(d.pop("publicationDate"))


        def _parse_published_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                published_at_type_0 = isoparse(data)



                return published_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        published_at = _parse_published_at(d.pop("publishedAt"))


        def _parse_metadata(data: object) -> GetIssueResponse200MetadataType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                metadata_type_0 = GetIssueResponse200MetadataType0.from_dict(data)



                return metadata_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(GetIssueResponse200MetadataType0 | None, data)

        metadata = _parse_metadata(d.pop("metadata"))


        created_at = isoparse(d.pop("createdAt"))




        updated_at = isoparse(d.pop("updatedAt"))




        get_issue_response_200 = cls(
            id=id,
            organization_id=organization_id,
            publication_id=publication_id,
            title=title,
            volume=volume,
            issue_number=issue_number,
            description=description,
            cover_image_url=cover_image_url,
            status=status,
            publication_date=publication_date,
            published_at=published_at,
            metadata=metadata,
            created_at=created_at,
            updated_at=updated_at,
        )


        get_issue_response_200.additional_properties = d
        return get_issue_response_200

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
