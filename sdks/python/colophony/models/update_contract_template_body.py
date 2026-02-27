from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast

if TYPE_CHECKING:
  from ..models.update_contract_template_body_merge_fields_type_0_item import UpdateContractTemplateBodyMergeFieldsType0Item





T = TypeVar("T", bound="UpdateContractTemplateBody")



@_attrs_define
class UpdateContractTemplateBody:
    """ 
        Attributes:
            name (str | Unset): New name
            description (None | str | Unset): New description (null to clear)
            body (str | Unset): New template body
            merge_fields (list[UpdateContractTemplateBodyMergeFieldsType0Item] | None | Unset): New merge field definitions
            is_default (bool | Unset): Set as default template
     """

    name: str | Unset = UNSET
    description: None | str | Unset = UNSET
    body: str | Unset = UNSET
    merge_fields: list[UpdateContractTemplateBodyMergeFieldsType0Item] | None | Unset = UNSET
    is_default: bool | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.update_contract_template_body_merge_fields_type_0_item import UpdateContractTemplateBodyMergeFieldsType0Item
        name = self.name

        description: None | str | Unset
        if isinstance(self.description, Unset):
            description = UNSET
        else:
            description = self.description

        body = self.body

        merge_fields: list[dict[str, Any]] | None | Unset
        if isinstance(self.merge_fields, Unset):
            merge_fields = UNSET
        elif isinstance(self.merge_fields, list):
            merge_fields = []
            for merge_fields_type_0_item_data in self.merge_fields:
                merge_fields_type_0_item = merge_fields_type_0_item_data.to_dict()
                merge_fields.append(merge_fields_type_0_item)


        else:
            merge_fields = self.merge_fields

        is_default = self.is_default


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if name is not UNSET:
            field_dict["name"] = name
        if description is not UNSET:
            field_dict["description"] = description
        if body is not UNSET:
            field_dict["body"] = body
        if merge_fields is not UNSET:
            field_dict["mergeFields"] = merge_fields
        if is_default is not UNSET:
            field_dict["isDefault"] = is_default

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.update_contract_template_body_merge_fields_type_0_item import UpdateContractTemplateBodyMergeFieldsType0Item
        d = dict(src_dict)
        name = d.pop("name", UNSET)

        def _parse_description(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        description = _parse_description(d.pop("description", UNSET))


        body = d.pop("body", UNSET)

        def _parse_merge_fields(data: object) -> list[UpdateContractTemplateBodyMergeFieldsType0Item] | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                merge_fields_type_0 = []
                _merge_fields_type_0 = data
                for merge_fields_type_0_item_data in (_merge_fields_type_0):
                    merge_fields_type_0_item = UpdateContractTemplateBodyMergeFieldsType0Item.from_dict(merge_fields_type_0_item_data)



                    merge_fields_type_0.append(merge_fields_type_0_item)

                return merge_fields_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[UpdateContractTemplateBodyMergeFieldsType0Item] | None | Unset, data)

        merge_fields = _parse_merge_fields(d.pop("mergeFields", UNSET))


        is_default = d.pop("isDefault", UNSET)

        update_contract_template_body = cls(
            name=name,
            description=description,
            body=body,
            merge_fields=merge_fields,
            is_default=is_default,
        )


        update_contract_template_body.additional_properties = d
        return update_contract_template_body

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
