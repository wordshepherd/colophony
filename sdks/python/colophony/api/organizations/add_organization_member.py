from http import HTTPStatus
from typing import Any
from urllib.parse import quote
from uuid import UUID

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.add_organization_member_body import AddOrganizationMemberBody
from ...models.add_organization_member_response_201_type_0 import AddOrganizationMemberResponse201Type0
from ...models.add_organization_member_response_201_type_1 import AddOrganizationMemberResponse201Type1
from ...types import Response


def _get_kwargs(
    org_id: UUID,
    *,
    body: AddOrganizationMemberBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/organizations/{org_id}/members".format(
            org_id=quote(str(org_id), safe=""),
        ),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> AddOrganizationMemberResponse201Type0 | AddOrganizationMemberResponse201Type1 | None:
    if response.status_code == 201:

        def _parse_response_201(
            data: object,
        ) -> AddOrganizationMemberResponse201Type0 | AddOrganizationMemberResponse201Type1:
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                response_201_type_0 = AddOrganizationMemberResponse201Type0.from_dict(data)

                return response_201_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            response_201_type_1 = AddOrganizationMemberResponse201Type1.from_dict(data)

            return response_201_type_1

        response_201 = _parse_response_201(response.json())

        return response_201

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[AddOrganizationMemberResponse201Type0 | AddOrganizationMemberResponse201Type1]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    org_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: AddOrganizationMemberBody,
) -> Response[AddOrganizationMemberResponse201Type0 | AddOrganizationMemberResponse201Type1]:
    """Add or invite a member

     Add a user to the organization by email. If the user does not have an account, sends an invitation
    email. Requires ADMIN role.

    Args:
        org_id (UUID):
        body (AddOrganizationMemberBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AddOrganizationMemberResponse201Type0 | AddOrganizationMemberResponse201Type1]
    """

    kwargs = _get_kwargs(
        org_id=org_id,
        body=body,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    org_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: AddOrganizationMemberBody,
) -> AddOrganizationMemberResponse201Type0 | AddOrganizationMemberResponse201Type1 | None:
    """Add or invite a member

     Add a user to the organization by email. If the user does not have an account, sends an invitation
    email. Requires ADMIN role.

    Args:
        org_id (UUID):
        body (AddOrganizationMemberBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AddOrganizationMemberResponse201Type0 | AddOrganizationMemberResponse201Type1
    """

    return sync_detailed(
        org_id=org_id,
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    org_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: AddOrganizationMemberBody,
) -> Response[AddOrganizationMemberResponse201Type0 | AddOrganizationMemberResponse201Type1]:
    """Add or invite a member

     Add a user to the organization by email. If the user does not have an account, sends an invitation
    email. Requires ADMIN role.

    Args:
        org_id (UUID):
        body (AddOrganizationMemberBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AddOrganizationMemberResponse201Type0 | AddOrganizationMemberResponse201Type1]
    """

    kwargs = _get_kwargs(
        org_id=org_id,
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    org_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: AddOrganizationMemberBody,
) -> AddOrganizationMemberResponse201Type0 | AddOrganizationMemberResponse201Type1 | None:
    """Add or invite a member

     Add a user to the organization by email. If the user does not have an account, sends an invitation
    email. Requires ADMIN role.

    Args:
        org_id (UUID):
        body (AddOrganizationMemberBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AddOrganizationMemberResponse201Type0 | AddOrganizationMemberResponse201Type1
    """

    return (
        await asyncio_detailed(
            org_id=org_id,
            client=client,
            body=body,
        )
    ).parsed
