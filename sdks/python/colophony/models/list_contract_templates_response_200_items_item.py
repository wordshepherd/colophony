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

if TYPE_CHECKING:
  from ..models.list_contract_templates_response_200_items_item_merge_fields_type_0_item import ListContractTemplatesResponse200ItemsItemMergeFieldsType0Item





T = TypeVar("T", bound="ListContractTemplatesResponse200ItemsItem")



@_attrs_define
class ListContractTemplatesResponse200ItemsItem:
    """ 
        Attributes:
            id (UUID): Contract template ID
            organization_id (UUID): Organization ID
            name (str): Template name
            description (None | str): Template description
            body (str): Template body with {{merge_field}} placeholders
            merge_fields (list[ListContractTemplatesResponse200ItemsItemMergeFieldsType0Item] | None): Merge field
                definitions
            is_default (bool): Whether this is the default template
            created_at (datetime.datetime): When the template was created
            updated_at (datetime.datetime): When the template was last updated
     """

    id: UUID
    organization_id: UUID
    name: str
    description: None | str
    body: str
    merge_fields: list[ListContractTemplatesResponse200ItemsItemMergeFieldsType0Item] | None
    is_default: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.list_contract_templates_response_200_items_item_merge_fields_type_0_item import ListContractTemplatesResponse200ItemsItemMergeFieldsType0Item
        id = str(self.id)

        organization_id = str(self.organization_id)

        name = self.name

        description: None | str
        description = self.description

        body = self.body

        merge_fields: list[dict[str, Any]] | None
        if isinstance(self.merge_fields, list):
            merge_fields = []
            for merge_fields_type_0_item_data in self.merge_fields:
                merge_fields_type_0_item = merge_fields_type_0_item_data.to_dict()
                merge_fields.append(merge_fields_type_0_item)


        else:
            merge_fields = self.merge_fields

        is_default = self.is_default

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "organizationId": organization_id,
            "name": name,
            "description": description,
            "body": body,
            "mergeFields": merge_fields,
            "isDefault": is_default,
            "createdAt": created_at,
            "updatedAt": updated_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.list_contract_templates_response_200_items_item_merge_fields_type_0_item import ListContractTemplatesResponse200ItemsItemMergeFieldsType0Item
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        organization_id = UUID(d.pop("organizationId"))




        name = d.pop("name")

        def _parse_description(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        description = _parse_description(d.pop("description"))


        body = d.pop("body")

        def _parse_merge_fields(data: object) -> list[ListContractTemplatesResponse200ItemsItemMergeFieldsType0Item] | None:
            if data is None:
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                merge_fields_type_0 = []
                _merge_fields_type_0 = data
                for merge_fields_type_0_item_data in (_merge_fields_type_0):
                    merge_fields_type_0_item = ListContractTemplatesResponse200ItemsItemMergeFieldsType0Item.from_dict(merge_fields_type_0_item_data)



                    merge_fields_type_0.append(merge_fields_type_0_item)

                return merge_fields_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[ListContractTemplatesResponse200ItemsItemMergeFieldsType0Item] | None, data)

        merge_fields = _parse_merge_fields(d.pop("mergeFields"))


        is_default = d.pop("isDefault")

        created_at = isoparse(d.pop("createdAt"))




        updated_at = isoparse(d.pop("updatedAt"))




        list_contract_templates_response_200_items_item = cls(
            id=id,
            organization_id=organization_id,
            name=name,
            description=description,
            body=body,
            merge_fields=merge_fields,
            is_default=is_default,
            created_at=created_at,
            updated_at=updated_at,
        )


        list_contract_templates_response_200_items_item.additional_properties = d
        return list_contract_templates_response_200_items_item

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
