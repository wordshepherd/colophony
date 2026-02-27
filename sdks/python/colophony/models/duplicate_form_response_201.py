from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.duplicate_form_response_201_status import DuplicateFormResponse201Status
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.duplicate_form_response_201_fields_item import DuplicateFormResponse201FieldsItem
  from ..models.duplicate_form_response_201_pages_item import DuplicateFormResponse201PagesItem





T = TypeVar("T", bound="DuplicateFormResponse201")



@_attrs_define
class DuplicateFormResponse201:
    """ 
        Attributes:
            id (UUID): Unique identifier for the form definition
            organization_id (UUID): ID of the owning organization
            name (str): Display name of the form
            description (None | str): Description of the form
            status (DuplicateFormResponse201Status): Current status of the form definition
            version (int): Version number
            duplicated_from_id (None | UUID): ID of the form this was duplicated from
            created_by (None | UUID): ID of the user who created the form
            published_at (datetime.datetime | None): When the form was published
            archived_at (datetime.datetime | None): When the form was archived
            created_at (datetime.datetime): When the form was created
            updated_at (datetime.datetime): When the form was last updated
            fields (list[DuplicateFormResponse201FieldsItem]): Fields in this form, ordered by sortOrder
            pages (list[DuplicateFormResponse201PagesItem]): Pages in this form, ordered by sortOrder
     """

    id: UUID
    organization_id: UUID
    name: str
    description: None | str
    status: DuplicateFormResponse201Status
    version: int
    duplicated_from_id: None | UUID
    created_by: None | UUID
    published_at: datetime.datetime | None
    archived_at: datetime.datetime | None
    created_at: datetime.datetime
    updated_at: datetime.datetime
    fields: list[DuplicateFormResponse201FieldsItem]
    pages: list[DuplicateFormResponse201PagesItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.duplicate_form_response_201_pages_item import DuplicateFormResponse201PagesItem
        from ..models.duplicate_form_response_201_fields_item import DuplicateFormResponse201FieldsItem
        id = str(self.id)

        organization_id = str(self.organization_id)

        name = self.name

        description: None | str
        description = self.description

        status = self.status.value

        version = self.version

        duplicated_from_id: None | str
        if isinstance(self.duplicated_from_id, UUID):
            duplicated_from_id = str(self.duplicated_from_id)
        else:
            duplicated_from_id = self.duplicated_from_id

        created_by: None | str
        if isinstance(self.created_by, UUID):
            created_by = str(self.created_by)
        else:
            created_by = self.created_by

        published_at: None | str
        if isinstance(self.published_at, datetime.datetime):
            published_at = self.published_at.isoformat()
        else:
            published_at = self.published_at

        archived_at: None | str
        if isinstance(self.archived_at, datetime.datetime):
            archived_at = self.archived_at.isoformat()
        else:
            archived_at = self.archived_at

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        fields = []
        for fields_item_data in self.fields:
            fields_item = fields_item_data.to_dict()
            fields.append(fields_item)



        pages = []
        for pages_item_data in self.pages:
            pages_item = pages_item_data.to_dict()
            pages.append(pages_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "organizationId": organization_id,
            "name": name,
            "description": description,
            "status": status,
            "version": version,
            "duplicatedFromId": duplicated_from_id,
            "createdBy": created_by,
            "publishedAt": published_at,
            "archivedAt": archived_at,
            "createdAt": created_at,
            "updatedAt": updated_at,
            "fields": fields,
            "pages": pages,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.duplicate_form_response_201_fields_item import DuplicateFormResponse201FieldsItem
        from ..models.duplicate_form_response_201_pages_item import DuplicateFormResponse201PagesItem
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        organization_id = UUID(d.pop("organizationId"))




        name = d.pop("name")

        def _parse_description(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        description = _parse_description(d.pop("description"))


        status = DuplicateFormResponse201Status(d.pop("status"))




        version = d.pop("version")

        def _parse_duplicated_from_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                duplicated_from_id_type_0 = UUID(data)



                return duplicated_from_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        duplicated_from_id = _parse_duplicated_from_id(d.pop("duplicatedFromId"))


        def _parse_created_by(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                created_by_type_0 = UUID(data)



                return created_by_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        created_by = _parse_created_by(d.pop("createdBy"))


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


        def _parse_archived_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                archived_at_type_0 = isoparse(data)



                return archived_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        archived_at = _parse_archived_at(d.pop("archivedAt"))


        created_at = isoparse(d.pop("createdAt"))




        updated_at = isoparse(d.pop("updatedAt"))




        fields = []
        _fields = d.pop("fields")
        for fields_item_data in (_fields):
            fields_item = DuplicateFormResponse201FieldsItem.from_dict(fields_item_data)



            fields.append(fields_item)


        pages = []
        _pages = d.pop("pages")
        for pages_item_data in (_pages):
            pages_item = DuplicateFormResponse201PagesItem.from_dict(pages_item_data)



            pages.append(pages_item)


        duplicate_form_response_201 = cls(
            id=id,
            organization_id=organization_id,
            name=name,
            description=description,
            status=status,
            version=version,
            duplicated_from_id=duplicated_from_id,
            created_by=created_by,
            published_at=published_at,
            archived_at=archived_at,
            created_at=created_at,
            updated_at=updated_at,
            fields=fields,
            pages=pages,
        )


        duplicate_form_response_201.additional_properties = d
        return duplicate_form_response_201

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
