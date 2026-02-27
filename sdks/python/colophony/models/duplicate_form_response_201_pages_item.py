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
  from ..models.duplicate_form_response_201_pages_item_branching_rules_type_0_item import DuplicateFormResponse201PagesItemBranchingRulesType0Item





T = TypeVar("T", bound="DuplicateFormResponse201PagesItem")



@_attrs_define
class DuplicateFormResponse201PagesItem:
    """ 
        Attributes:
            id (UUID):
            form_definition_id (UUID):
            title (str):
            description (None | str):
            sort_order (int):
            branching_rules (list[DuplicateFormResponse201PagesItemBranchingRulesType0Item] | None):
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
     """

    id: UUID
    form_definition_id: UUID
    title: str
    description: None | str
    sort_order: int
    branching_rules: list[DuplicateFormResponse201PagesItemBranchingRulesType0Item] | None
    created_at: datetime.datetime
    updated_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.duplicate_form_response_201_pages_item_branching_rules_type_0_item import DuplicateFormResponse201PagesItemBranchingRulesType0Item
        id = str(self.id)

        form_definition_id = str(self.form_definition_id)

        title = self.title

        description: None | str
        description = self.description

        sort_order = self.sort_order

        branching_rules: list[dict[str, Any]] | None
        if isinstance(self.branching_rules, list):
            branching_rules = []
            for branching_rules_type_0_item_data in self.branching_rules:
                branching_rules_type_0_item = branching_rules_type_0_item_data.to_dict()
                branching_rules.append(branching_rules_type_0_item)


        else:
            branching_rules = self.branching_rules

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "formDefinitionId": form_definition_id,
            "title": title,
            "description": description,
            "sortOrder": sort_order,
            "branchingRules": branching_rules,
            "createdAt": created_at,
            "updatedAt": updated_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.duplicate_form_response_201_pages_item_branching_rules_type_0_item import DuplicateFormResponse201PagesItemBranchingRulesType0Item
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        form_definition_id = UUID(d.pop("formDefinitionId"))




        title = d.pop("title")

        def _parse_description(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        description = _parse_description(d.pop("description"))


        sort_order = d.pop("sortOrder")

        def _parse_branching_rules(data: object) -> list[DuplicateFormResponse201PagesItemBranchingRulesType0Item] | None:
            if data is None:
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                branching_rules_type_0 = []
                _branching_rules_type_0 = data
                for branching_rules_type_0_item_data in (_branching_rules_type_0):
                    branching_rules_type_0_item = DuplicateFormResponse201PagesItemBranchingRulesType0Item.from_dict(branching_rules_type_0_item_data)



                    branching_rules_type_0.append(branching_rules_type_0_item)

                return branching_rules_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[DuplicateFormResponse201PagesItemBranchingRulesType0Item] | None, data)

        branching_rules = _parse_branching_rules(d.pop("branchingRules"))


        created_at = isoparse(d.pop("createdAt"))




        updated_at = isoparse(d.pop("updatedAt"))




        duplicate_form_response_201_pages_item = cls(
            id=id,
            form_definition_id=form_definition_id,
            title=title,
            description=description,
            sort_order=sort_order,
            branching_rules=branching_rules,
            created_at=created_at,
            updated_at=updated_at,
        )


        duplicate_form_response_201_pages_item.additional_properties = d
        return duplicate_form_response_201_pages_item

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
