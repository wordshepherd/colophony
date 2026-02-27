from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast

if TYPE_CHECKING:
  from ..models.create_contract_template_body_merge_fields_item import CreateContractTemplateBodyMergeFieldsItem





T = TypeVar("T", bound="CreateContractTemplateBody")



@_attrs_define
class CreateContractTemplateBody:
    """ 
        Attributes:
            name (str): Template name
            body (str): Template body with {{merge_field}} placeholders
            description (str | Unset): Template description
            merge_fields (list[CreateContractTemplateBodyMergeFieldsItem] | Unset): Merge field definitions
            is_default (bool | Unset): Set as default template
     """

    name: str
    body: str
    description: str | Unset = UNSET
    merge_fields: list[CreateContractTemplateBodyMergeFieldsItem] | Unset = UNSET
    is_default: bool | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.create_contract_template_body_merge_fields_item import CreateContractTemplateBodyMergeFieldsItem
        name = self.name

        body = self.body

        description = self.description

        merge_fields: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.merge_fields, Unset):
            merge_fields = []
            for merge_fields_item_data in self.merge_fields:
                merge_fields_item = merge_fields_item_data.to_dict()
                merge_fields.append(merge_fields_item)



        is_default = self.is_default


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "name": name,
            "body": body,
        })
        if description is not UNSET:
            field_dict["description"] = description
        if merge_fields is not UNSET:
            field_dict["mergeFields"] = merge_fields
        if is_default is not UNSET:
            field_dict["isDefault"] = is_default

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.create_contract_template_body_merge_fields_item import CreateContractTemplateBodyMergeFieldsItem
        d = dict(src_dict)
        name = d.pop("name")

        body = d.pop("body")

        description = d.pop("description", UNSET)

        _merge_fields = d.pop("mergeFields", UNSET)
        merge_fields: list[CreateContractTemplateBodyMergeFieldsItem] | Unset = UNSET
        if _merge_fields is not UNSET:
            merge_fields = []
            for merge_fields_item_data in _merge_fields:
                merge_fields_item = CreateContractTemplateBodyMergeFieldsItem.from_dict(merge_fields_item_data)



                merge_fields.append(merge_fields_item)


        is_default = d.pop("isDefault", UNSET)

        create_contract_template_body = cls(
            name=name,
            body=body,
            description=description,
            merge_fields=merge_fields,
            is_default=is_default,
        )


        create_contract_template_body.additional_properties = d
        return create_contract_template_body

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
