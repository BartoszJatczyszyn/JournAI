from __future__ import annotations
from typing import Optional

# Services (application)
from application.services.analytics_service import AnalyticsService
from application.services.activities_service import ActivitiesService
from application.services.sleeps_service import SleepsService
from application.services.weight_service import WeightService
from application.services.gym_service import GymService
from application.services.predictions_service import PredictionsService
from application.services.insights_service import InsightsService
from application.services.llm_service import LLMService
from application.services.admin_service import AdminService
from application.services.core_service import CoreService
from application.services.journal_analytics_service import JournalAnalyticsService
from application.services.strength_service import StrengthService

# Repositories (infrastructure)
from infrastructure.repositories.activities_postgres import PostgresActivitiesRepository
from infrastructure.repositories.sleeps_postgres import PostgresSleepsRepository
from infrastructure.repositories.weight_postgres import PostgresWeightRepository
from infrastructure.repositories.gym_postgres import PostgresGymRepository
from infrastructure.repositories.strength_postgres import PostgresStrengthRepository


class DIContainer:
    """Very small DI container with lazy singletons.

    Keep it simple: resolve services and repos on demand and cache them.
    """

    def __init__(self) -> None:
        # caches
        # Use loose typing here to avoid editor resolution issues with re-exported classes
        self._analytics_service = None
        self._activities_service = None
        self._sleeps_service = None
        self._weight_service = None
        self._gym_service = None
        self._predictions_service = None
        self._insights_service = None
        self._llm_service = None
        self._admin_service = None
        self._core_service = None
        self._journal_analytics_service = None
        self._strength_service = None
        self._activities_repo = None
        self._sleeps_repo = None
        self._weight_repo = None
        self._gym_repo = None
        self._strength_repo = None

    # Repositories
    def activities_repo(self) -> PostgresActivitiesRepository:
        if not self._activities_repo:
            self._activities_repo = PostgresActivitiesRepository()
        return self._activities_repo

    def sleeps_repo(self) -> PostgresSleepsRepository:
        if not self._sleeps_repo:
            self._sleeps_repo = PostgresSleepsRepository()
        return self._sleeps_repo

    def weight_repo(self) -> PostgresWeightRepository:
        if not self._weight_repo:
            self._weight_repo = PostgresWeightRepository()
        return self._weight_repo

    def gym_repo(self) -> PostgresGymRepository:
        if not self._gym_repo:
            self._gym_repo = PostgresGymRepository()
        return self._gym_repo

    def strength_repo(self) -> PostgresStrengthRepository:
        if not self._strength_repo:
            self._strength_repo = PostgresStrengthRepository()
        return self._strength_repo

    # Services
    def analytics_service(self) -> AnalyticsService:
        if not self._analytics_service:
            self._analytics_service = AnalyticsService()
        return self._analytics_service

    def activities_service(self) -> ActivitiesService:
        if not self._activities_service:
            self._activities_service = ActivitiesService(self.activities_repo())
        return self._activities_service

    def sleeps_service(self) -> SleepsService:
        if not self._sleeps_service:
            self._sleeps_service = SleepsService(self.sleeps_repo())
        return self._sleeps_service

    def weight_service(self) -> WeightService:
        if not self._weight_service:
            self._weight_service = WeightService(self.weight_repo())
        return self._weight_service

    def gym_service(self) -> GymService:
        if not self._gym_service:
            self._gym_service = GymService(self.gym_repo())
        return self._gym_service

    def predictions_service(self) -> PredictionsService:
        if not self._predictions_service:
            self._predictions_service = PredictionsService()
        return self._predictions_service

    def insights_service(self) -> InsightsService:
        if not self._insights_service:
            self._insights_service = InsightsService()
        return self._insights_service

    def llm_service(self) -> LLMService:
        if not self._llm_service:
            self._llm_service = LLMService()
        return self._llm_service

    def admin_service(self) -> AdminService:
        if not self._admin_service:
            self._admin_service = AdminService()
        return self._admin_service

    def core_service(self) -> CoreService:
        if not self._core_service:
            self._core_service = CoreService()
        return self._core_service

    def journal_analytics_service(self) -> JournalAnalyticsService:
        if not self._journal_analytics_service:
            self._journal_analytics_service = JournalAnalyticsService()
        return self._journal_analytics_service

    def strength_service(self) -> StrengthService:
        if not self._strength_service:
            self._strength_service = StrengthService(self.strength_repo())
        return self._strength_service


di = DIContainer()
