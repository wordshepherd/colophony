from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.add_form_field_response_201_field_type import AddFormFieldResponse201FieldType
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.add_form_field_response_201_conditional_rules_type_0_item import AddFormFieldResponse201ConditionalRulesType0Item
  from ..models.add_form_field_response_201_config_type_0 import AddFormFieldResponse201ConfigType0





T = TypeVar("T", bound="AddFormFieldResponse201")



@_attrs_define
class AddFormFieldResponse201:
    """ 
        Attributes:
            id (UUID): Unique identifier for the field
            form_definition_id (UUID): ID of the parent form definition
            field_key (str): Machine name for the field (unique per form)
            field_type (AddFormFieldResponse201FieldType): Type of form field
            label (str): Human-readable label
            description (None | str): Help text for the field
            placeholder (None | str): Placeholder text for input fields
            required (bool): Whether the field is required for submission
            sort_order (int): Display order within the form
            config (AddFormFieldResponse201ConfigType0 | None): Type-specific configuration for the field
            conditional_rules (list[AddFormFieldResponse201ConditionalRulesType0Item] | None): Conditional display rules
            branch_id (None | str): Branch ID this field belongs to (from source field config)
            page_id (None | UUID): Page this field belongs to
            created_at (datetime.datetime): When the field was created
            updated_at (datetime.datetime): When the field was last updated
     """

    id: UUID
    form_definition_id: UUID
    field_key: str
    field_type: AddFormFieldResponse201FieldType
    label: str
    description: None | str
    placeholder: None | str
    required: bool
    sort_order: int
    config: AddFormFieldResponse201ConfigType0 | None
    conditional_rules: list[AddFormFieldResponse201ConditionalRulesType0Item] | None
    branch_id: None | str
    page_id: None | UUID
    created_at: datetime.datetime
    updated_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.add_form_field_response_201_config_type_0 import AddFormFieldResponse201ConfigType0
        from ..models.add_form_field_response_201_conditional_rules_type_0_item import AddFormFieldResponse201ConditionalRulesType0Item
        id = str(self.id)

        form_definition_id = str(self.form_definition_id)

        field_key = self.field_key

        field_type = self.field_type.value

        label = self.label

        description: None | str
        description = self.description

        placeholder: None | str
        placeholder = self.placeholder

        required = self.required

        sort_order = self.sort_order

        config: dict[str, Any] | None
        if isinstance(self.config, AddFormFieldResponse201ConfigType0):
            config = self.config.to_dict()
        else:
            config = self.config

        conditional_rules: list[dict[str, Any]] | None
        if isinstance(self.conditional_rules, list):
            conditional_rules = []
            for conditional_rules_type_0_item_data in self.conditional_rules:
                conditional_rules_type_0_item = conditional_rules_type_0_item_data.to_dict()
                conditional_rules.append(conditional_rules_type_0_item)


        else:
            conditional_rules = self.conditional_rules

        branch_id: None | str
        branch_id = self.branch_id

        page_id: None | str
        if isinstance(self.page_id, UUID):
            page_id = str(self.page_id)
        else:
            page_id = self.page_id

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "formDefinitionId": form_definition_id,
            "fieldKey": field_key,
            "fieldType": field_type,
            "label": label,
            "description": description,
            "placeholder": placeholder,
            "required": required,
            "sortOrder": sort_order,
            "config": config,
            "conditionalRules": conditional_rules,
            "branchId": branch_id,
            "pageId": page_id,
            "createdAt": created_at,
            "updatedAt": updated_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.add_form_field_response_201_conditional_rules_type_0_item import AddFormFieldResponse201ConditionalRulesType0Item
        from ..models.add_form_field_response_201_config_type_0 import AddFormFieldResponse201ConfigType0
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        form_definition_id = UUID(d.pop("formDefinitionId"))




        field_key = d.pop("fieldKey")

        field_type = AddFormFieldResponse201FieldType(d.pop("fieldType"))




        label = d.pop("label")

        def _parse_description(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        description = _parse_description(d.pop("description"))


        def _parse_placeholder(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        placeholder = _parse_placeholder(d.pop("placeholder"))


        required = d.pop("required")

        sort_order = d.pop("sortOrder")

        def _parse_config(data: object) -> AddFormFieldResponse201ConfigType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                config_type_0 = AddFormFieldResponse201ConfigType0.from_dict(data)



                return config_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(AddFormFieldResponse201ConfigType0 | None, data)

        config = _parse_config(d.pop("config"))


        def _parse_conditional_rules(data: object) -> list[AddFormFieldResponse201ConditionalRulesType0Item] | None:
            if data is None:
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                conditional_rules_type_0 = []
                _conditional_rules_type_0 = data
                for conditional_rules_type_0_item_data in (_conditional_rules_type_0):
                    conditional_rules_type_0_item = AddFormFieldResponse201ConditionalRulesType0Item.from_dict(conditional_rules_type_0_item_data)



                    conditional_rules_type_0.append(conditional_rules_type_0_item)

                return conditional_rules_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[AddFormFieldResponse201ConditionalRulesType0Item] | None, data)

        conditional_rules = _parse_conditional_rules(d.pop("conditionalRules"))


        def _parse_branch_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        branch_id = _parse_branch_id(d.pop("branchId"))


        def _parse_page_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                page_id_type_0 = UUID(data)



                return page_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        page_id = _parse_page_id(d.pop("pageId"))


        created_at = isoparse(d.pop("createdAt"))




        updated_at = isoparse(d.pop("updatedAt"))




        add_form_field_response_201 = cls(
            id=id,
            form_definition_id=form_definition_id,
            field_key=field_key,
            field_type=field_type,
            label=label,
            description=description,
            placeholder=placeholder,
            required=required,
            sort_order=sort_order,
            config=config,
            conditional_rules=conditional_rules,
            branch_id=branch_id,
            page_id=page_id,
            created_at=created_at,
            updated_at=updated_at,
        )


        add_form_field_response_201.additional_properties = d
        return add_form_field_response_201

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
