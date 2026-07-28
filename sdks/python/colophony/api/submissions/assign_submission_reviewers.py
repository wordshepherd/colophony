from http import HTTPStatus
from typing import Any
from urllib.parse import quote
from uuid import UUID

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.assign_submission_reviewers_body import AssignSubmissionReviewersBody
from ...models.assign_submission_reviewers_response_201_item import AssignSubmissionReviewersResponse201Item
from ...types import Response


def _get_kwargs(
    id: UUID,
    *,
    body: AssignSubmissionReviewersBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/submissions/{id}/reviewers".format(
            id=quote(str(id), safe=""),
        ),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> list[AssignSubmissionReviewersResponse201Item] | None:
    if response.status_code == 201:
        response_201 = []
        _response_201 = response.json()
        for response_201_item_data in _response_201:
            response_201_item = AssignSubmissionReviewersResponse201Item.from_dict(response_201_item_data)

            response_201.append(response_201_item)

        return response_201

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[list[AssignSubmissionReviewersResponse201Item]]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: AssignSubmissionReviewersBody,
) -> Response[list[AssignSubmissionReviewersResponse201Item]]:
    """Assign reviewers

     Assign one or more org members as reviewers on a submission. Requires EDITOR or ADMIN role.

    Args:
        id (UUID): Resource UUID
        body (AssignSubmissionReviewersBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[list[AssignSubmissionReviewersResponse201Item]]
    """

    kwargs = _get_kwargs(
        id=id,
        body=body,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: AssignSubmissionReviewersBody,
) -> list[AssignSubmissionReviewersResponse201Item] | None:
    """Assign reviewers

     Assign one or more org members as reviewers on a submission. Requires EDITOR or ADMIN role.

    Args:
        id (UUID): Resource UUID
        body (AssignSubmissionReviewersBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        list[AssignSubmissionReviewersResponse201Item]
    """

    return sync_detailed(
        id=id,
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: AssignSubmissionReviewersBody,
) -> Response[list[AssignSubmissionReviewersResponse201Item]]:
    """Assign reviewers

     Assign one or more org members as reviewers on a submission. Requires EDITOR or ADMIN role.

    Args:
        id (UUID): Resource UUID
        body (AssignSubmissionReviewersBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[list[AssignSubmissionReviewersResponse201Item]]
    """

    kwargs = _get_kwargs(
        id=id,
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: AssignSubmissionReviewersBody,
) -> list[AssignSubmissionReviewersResponse201Item] | None:
    """Assign reviewers

     Assign one or more org members as reviewers on a submission. Requires EDITOR or ADMIN role.

    Args:
        id (UUID): Resource UUID
        body (AssignSubmissionReviewersBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        list[AssignSubmissionReviewersResponse201Item]
    """

    return (
        await asyncio_detailed(
            id=id,
            client=client,
            body=body,
        )
    ).parsed
