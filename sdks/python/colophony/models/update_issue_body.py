from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from dateutil.parser import isoparse
from typing import cast
import datetime






T = TypeVar("T", bound="UpdateIssueBody")



@_attrs_define
class UpdateIssueBody:
    """ 
        Attributes:
            title (str | Unset): New title
            volume (int | None | Unset): New volume number
            issue_number (int | None | Unset): New issue number
            description (None | str | Unset): New description
            cover_image_url (None | str | Unset): New cover image URL
            publication_date (datetime.datetime | None | Unset): New publication date
     """

    title: str | Unset = UNSET
    volume: int | None | Unset = UNSET
    issue_number: int | None | Unset = UNSET
    description: None | str | Unset = UNSET
    cover_image_url: None | str | Unset = UNSET
    publication_date: datetime.datetime | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        title = self.title

        volume: int | None | Unset
        if isinstance(self.volume, Unset):
            volume = UNSET
        else:
            volume = self.volume

        issue_number: int | None | Unset
        if isinstance(self.issue_number, Unset):
            issue_number = UNSET
        else:
            issue_number = self.issue_number

        description: None | str | Unset
        if isinstance(self.description, Unset):
            description = UNSET
        else:
            description = self.description

        cover_image_url: None | str | Unset
        if isinstance(self.cover_image_url, Unset):
            cover_image_url = UNSET
        else:
            cover_image_url = self.cover_image_url

        publication_date: None | str | Unset
        if isinstance(self.publication_date, Unset):
            publication_date = UNSET
        elif isinstance(self.publication_date, datetime.datetime):
            publication_date = self.publication_date.isoformat()
        else:
            publication_date = self.publication_date


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if title is not UNSET:
            field_dict["title"] = title
        if volume is not UNSET:
            field_dict["volume"] = volume
        if issue_number is not UNSET:
            field_dict["issueNumber"] = issue_number
        if description is not UNSET:
            field_dict["description"] = description
        if cover_image_url is not UNSET:
            field_dict["coverImageUrl"] = cover_image_url
        if publication_date is not UNSET:
            field_dict["publicationDate"] = publication_date

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        title = d.pop("title", UNSET)

        def _parse_volume(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        volume = _parse_volume(d.pop("volume", UNSET))


        def _parse_issue_number(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        issue_number = _parse_issue_number(d.pop("issueNumber", UNSET))


        def _parse_description(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        description = _parse_description(d.pop("description", UNSET))


        def _parse_cover_image_url(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        cover_image_url = _parse_cover_image_url(d.pop("coverImageUrl", UNSET))


        def _parse_publication_date(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                publication_date_type_0 = isoparse(data)



                return publication_date_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        publication_date = _parse_publication_date(d.pop("publicationDate", UNSET))


        update_issue_body = cls(
            title=title,
            volume=volume,
            issue_number=issue_number,
            description=description,
            cover_image_url=cover_image_url,
            publication_date=publication_date,
        )


        update_issue_body.additional_properties = d
        return update_issue_body

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
