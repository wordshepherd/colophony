from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.update_form_field_body_conditional_rules_type_0_item import UpdateFormFieldBodyConditionalRulesType0Item
  from ..models.update_form_field_body_config import UpdateFormFieldBodyConfig





T = TypeVar("T", bound="UpdateFormFieldBody")



@_attrs_define
class UpdateFormFieldBody:
    """ 
        Attributes:
            label (str | Unset): New label
            description (str | Unset): New help text
            placeholder (str | Unset): New placeholder
            required (bool | Unset): New required state
            config (UpdateFormFieldBodyConfig | Unset): New configuration
            conditional_rules (list[UpdateFormFieldBodyConditionalRulesType0Item] | None | Unset): Conditional display rules
            branch_id (None | Unset | UUID): Branch ID to assign this field to
            page_id (None | Unset | UUID): Page to assign this field to
     """

    label: str | Unset = UNSET
    description: str | Unset = UNSET
    placeholder: str | Unset = UNSET
    required: bool | Unset = UNSET
    config: UpdateFormFieldBodyConfig | Unset = UNSET
    conditional_rules: list[UpdateFormFieldBodyConditionalRulesType0Item] | None | Unset = UNSET
    branch_id: None | Unset | UUID = UNSET
    page_id: None | Unset | UUID = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.update_form_field_body_conditional_rules_type_0_item import UpdateFormFieldBodyConditionalRulesType0Item
        from ..models.update_form_field_body_config import UpdateFormFieldBodyConfig
        label = self.label

        description = self.description

        placeholder = self.placeholder

        required = self.required

        config: dict[str, Any] | Unset = UNSET
        if not isinstance(self.config, Unset):
            config = self.config.to_dict()

        conditional_rules: list[dict[str, Any]] | None | Unset
        if isinstance(self.conditional_rules, Unset):
            conditional_rules = UNSET
        elif isinstance(self.conditional_rules, list):
            conditional_rules = []
            for conditional_rules_type_0_item_data in self.conditional_rules:
                conditional_rules_type_0_item = conditional_rules_type_0_item_data.to_dict()
                conditional_rules.append(conditional_rules_type_0_item)


        else:
            conditional_rules = self.conditional_rules

        branch_id: None | str | Unset
        if isinstance(self.branch_id, Unset):
            branch_id = UNSET
        elif isinstance(self.branch_id, UUID):
            branch_id = str(self.branch_id)
        else:
            branch_id = self.branch_id

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
        })
        if label is not UNSET:
            field_dict["label"] = label
        if description is not UNSET:
            field_dict["description"] = description
        if placeholder is not UNSET:
            field_dict["placeholder"] = placeholder
        if required is not UNSET:
            field_dict["required"] = required
        if config is not UNSET:
            field_dict["config"] = config
        if conditional_rules is not UNSET:
            field_dict["conditionalRules"] = conditional_rules
        if branch_id is not UNSET:
            field_dict["branchId"] = branch_id
        if page_id is not UNSET:
            field_dict["pageId"] = page_id

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.update_form_field_body_conditional_rules_type_0_item import UpdateFormFieldBodyConditionalRulesType0Item
        from ..models.update_form_field_body_config import UpdateFormFieldBodyConfig
        d = dict(src_dict)
        label = d.pop("label", UNSET)

        description = d.pop("description", UNSET)

        placeholder = d.pop("placeholder", UNSET)

        required = d.pop("required", UNSET)

        _config = d.pop("config", UNSET)
        config: UpdateFormFieldBodyConfig | Unset
        if isinstance(_config,  Unset):
            config = UNSET
        else:
            config = UpdateFormFieldBodyConfig.from_dict(_config)




        def _parse_conditional_rules(data: object) -> list[UpdateFormFieldBodyConditionalRulesType0Item] | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                conditional_rules_type_0 = []
                _conditional_rules_type_0 = data
                for conditional_rules_type_0_item_data in (_conditional_rules_type_0):
                    conditional_rules_type_0_item = UpdateFormFieldBodyConditionalRulesType0Item.from_dict(conditional_rules_type_0_item_data)



                    conditional_rules_type_0.append(conditional_rules_type_0_item)

                return conditional_rules_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[UpdateFormFieldBodyConditionalRulesType0Item] | None | Unset, data)

        conditional_rules = _parse_conditional_rules(d.pop("conditionalRules", UNSET))


        def _parse_branch_id(data: object) -> None | Unset | UUID:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                branch_id_type_0 = UUID(data)



                return branch_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Unset | UUID, data)

        branch_id = _parse_branch_id(d.pop("branchId", UNSET))


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


        update_form_field_body = cls(
            label=label,
            description=description,
            placeholder=placeholder,
            required=required,
            config=config,
            conditional_rules=conditional_rules,
            branch_id=branch_id,
            page_id=page_id,
        )


        update_form_field_body.additional_properties = d
        return update_form_field_body

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
