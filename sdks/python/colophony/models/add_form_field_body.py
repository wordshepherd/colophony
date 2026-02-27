from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.add_form_field_body_field_type import AddFormFieldBodyFieldType
from ..types import UNSET, Unset
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.add_form_field_body_config import AddFormFieldBodyConfig





T = TypeVar("T", bound="AddFormFieldBody")



@_attrs_define
class AddFormFieldBody:
    """ 
        Attributes:
            field_key (str): Machine name for the field
            field_type (AddFormFieldBodyFieldType): Type of form field
            label (str): Human-readable label
            description (str | Unset): Help text for the field
            placeholder (str | Unset): Placeholder text
            required (bool | Unset): Whether the field is required Default: False.
            sort_order (int | Unset): Display order (auto-assigned if omitted)
            config (AddFormFieldBodyConfig | Unset): Type-specific configuration
            branch_id (UUID | Unset): Branch ID to assign this field to
            page_id (None | Unset | UUID): Page to assign this field to
     """

    field_key: str
    field_type: AddFormFieldBodyFieldType
    label: str
    description: str | Unset = UNSET
    placeholder: str | Unset = UNSET
    required: bool | Unset = False
    sort_order: int | Unset = UNSET
    config: AddFormFieldBodyConfig | Unset = UNSET
    branch_id: UUID | Unset = UNSET
    page_id: None | Unset | UUID = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.add_form_field_body_config import AddFormFieldBodyConfig
        field_key = self.field_key

        field_type = self.field_type.value

        label = self.label

        description = self.description

        placeholder = self.placeholder

        required = self.required

        sort_order = self.sort_order

        config: dict[str, Any] | Unset = UNSET
        if not isinstance(self.config, Unset):
            config = self.config.to_dict()

        branch_id: str | Unset = UNSET
        if not isinstance(self.branch_id, Unset):
            branch_id = str(self.branch_id)

        page_id: None | str | Unset
        if isinstance(self.page_id, Unset):
            page_id = UNSET
        elif isinstance(self.page_id, UUID):
            page_id = str(self.page_id)
        else:
            page_id = self.page_id


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "fieldKey": field_key,
            "fieldType": field_type,
            "label": label,
        })
        if description is not UNSET:
            field_dict["description"] = description
        if placeholder is not UNSET:
            field_dict["placeholder"] = placeholder
        if required is not UNSET:
            field_dict["required"] = required
        if sort_order is not UNSET:
            field_dict["sortOrder"] = sort_order
        if config is not UNSET:
            field_dict["config"] = config
        if branch_id is not UNSET:
            field_dict["branchId"] = branch_id
        if page_id is not UNSET:
            field_dict["pageId"] = page_id

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.add_form_field_body_config import AddFormFieldBodyConfig
        d = dict(src_dict)
        field_key = d.pop("fieldKey")

        field_type = AddFormFieldBodyFieldType(d.pop("fieldType"))




        label = d.pop("label")

        description = d.pop("description", UNSET)

        placeholder = d.pop("placeholder", UNSET)

        required = d.pop("required", UNSET)

        sort_order = d.pop("sortOrder", UNSET)

        _config = d.pop("config", UNSET)
        config: AddFormFieldBodyConfig | Unset
        if isinstance(_config,  Unset):
            config = UNSET
        else:
            config = AddFormFieldBodyConfig.from_dict(_config)




        _branch_id = d.pop("branchId", UNSET)
        branch_id: UUID | Unset
        if isinstance(_branch_id,  Unset):
            branch_id = UNSET
        else:
            branch_id = UUID(_branch_id)




        def _parse_page_id(data: object) -> None | Unset | UUID:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                page_id_type_0 = UUID(data)



                return page_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Unset | UUID, data)

        page_id = _parse_page_id(d.pop("pageId", UNSET))


        add_form_field_body = cls(
            field_key=field_key,
            field_type=field_type,
            label=label,
            description=description,
            placeholder=placeholder,
            required=required,
            sort_order=sort_order,
            config=config,
            branch_id=branch_id,
            page_id=page_id,
        )


        add_form_field_body.additional_properties = d
        return add_form_field_body

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
